const crypto = require("crypto");
const paymentModel = require("../models/paymentModel");
const merchantModel = require("../models/merchantModel");
const withdrawModel = require("../models/withdrawModel");
const transactionModel = require("../models/transactionModel");
const notificationModel = require("../models/notificationModel");
const sendEmailNotification = require("../utils/emailNotification");
const axios = require("axios");
require("dotenv").config();

const KORAPAY_API_BASE_URL = process.env.KORAPAY_API_BASE_URL;
const KORAPAY_SECRET_KEY = process.env.KORAPAY_SECRET_KEY;

// Webhook Endpoint
exports.webhook = async (req, res) => {
  try {
    const korapaySignature = req.headers["x-korapay-signature"];

    // Verify the presence of the signature
    if (!korapaySignature) {
      return res.status(400).send({ error: "Missing signature" });
    }

    // Hash the `data` object from the request payload using your Korapay secret key
    const hash = crypto
      .createHmac("sha256", KORAPAY_SECRET_KEY)
      .update(JSON.stringify(req.body.data))
      .digest("hex");

    // Compare the computed hash with the signature from the headers
    if (hash !== korapaySignature) {
      console.error("Invalid signature:", {
        expected: hash,
        received: korapaySignature,
      });
      // return res.status(400).send({ error: "Invalid signature" });
    }

    // Parse the event
    const event = req.body;

    // Prevent duplicate event processing (check by transaction reference)
    const existingEvent = await paymentModel.findOne({
      reference: event.data.reference,
    });
    const existingEventW = await withdrawModel.findOne({
      reference: event.data.reference,
    });
    const existingEventT = await transactionModel.findOne({
      reference: event.data.reference,
    });

    if (
      (existingEvent && existingEvent.status === event.data.status) ||
      (existingEventW && existingEventW.status === event.data.status) ||
      (existingEventT && existingEventT.status === event.data.status)
    ) {
      console.log(
        `Event with reference ${event.data.reference} already processed.`
      );
      return res.status(200).json({ message: "Event already processed" });
    }

    // Event handling switch
    switch (event.event) {
      case "charge.success":
        await handleChargeSuccess(event);
        break;
      case "charge.failed":
        await handleChargeFailed(event);
        break;
      case "transfer.success":
        await handleTransferSuccess(event);
        break;
      case "transfer.failed":
        await handleTransferFailed(event);
        break;
      default:
        console.log(`Unhandled event type ${event.event}`);
        break;
    }

    // Send 200 OK after full processing
    return res.status(200).json({
      message: "Webhook received and processed successfully",
    });
  } catch (error) {
    console.error("Error handling Korapay webhook", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Event handlers
const handleChargeSuccess = async (event) => {
  const paymentData = event.data;
  console.log("Handling charge success:");

  try {
    // Find the payment record by reference, starting with paymentModel
    let paymentRecord = await paymentModel.findOne({
      reference: paymentData.reference,
    });

    // If not found in paymentModel, search in transactionModel
    if (!paymentRecord) {
      paymentRecord = await transactionModel.findOne({
        reference: paymentData.reference,
      });
    }

    if (!paymentRecord) {
      console.error(
        "Payment record not found for reference:",
        paymentData.reference
      );
      return;
    }

    // Update the payment status to "success"
    paymentRecord.status = "success";

    // Fetch the merchant based on the payment record's merchant ID
    const merchant = await merchantModel.findById(paymentRecord.merchant);
    if (!merchant) {
      console.error("Merchant not found for payment:", paymentRecord.reference);
      return;
    }

    // Prepare the payout payload for the merchant
    const payoutPayload = {
      destination: {
        amount: paymentRecord.amount,
        currency: "NGN",
        type: "bank_account",
        bank_account: {
          account_number: merchant.bankAccountDetails.accountNumber,
          bank_code: merchant.bankAccountDetails.bankCode,
          account_name: merchant.bankAccountDetails.accountName,
        },
        narration: `Disbursement of ${paymentRecord.amount} NGN to ${merchant.name}`,
      },
      reference: `comm_${paymentRecord.reference}`,
    };

    // Process the payout to the merchant's account
    const payoutResult = await processPayout(payoutPayload);
    if (!payoutResult.success) {
      console.error(
        `Payout failed for merchant ${merchant._id}:`,
        payoutResult.error
      );
      paymentRecord.status = "payout_failed"; // Update status if payout failed
      await paymentRecord.save();
      return;
    }

    console.log(
      `Successfully disbursed ${paymentRecord.amount} to merchant ${merchant._id}`
    );

    // Add the payment amount to the merchant's balance
    merchant.balance += paymentRecord.amount;

    // Push the transaction reference into transactionHistory
    merchant.transactionHistory.push({
      reference: paymentRecord.reference,
      amount: paymentRecord.amount,
      status: paymentRecord.status,
      type: paymentRecord.type || "charge", // Set type as 'charge' by default
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
    });

    // Push the notification message into the notification array
    const notifyMsg = {
      notificationMessage: `Payment of ${paymentRecord.amount} ${paymentRecord.currency} was successful. Reference: ${paymentRecord.reference}. \n\n PayWave Team`,
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
    };
    merchant.notification.push(notifyMsg);

    // Save the updated merchant and payment records concurrently
    await Promise.all([merchant.save(), paymentRecord.save()]);

    // Send notification email and create notification record concurrently
    await Promise.all([
      sendEmailNotification(
        merchant.email,
        "Payment Successful",
        `Customer payment of ${paymentRecord.amount} ${paymentRecord.currency} was successful. Reference: ${paymentRecord.reference}. \n\n PayWave Team`
      ),
      notificationModel.create({
        merchant: merchant._id,
        email: merchant.email,
        subject: "Payment Successful",
        message: `Payment of ${paymentRecord.amount} ${paymentRecord.currency} was successful. Reference: ${paymentRecord.reference}. \n\n PayWave Team`,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
      }),
    ]);

    console.log(
      "Payment verification and merchant notification completed successfully!"
    );
  } catch (err) {
    console.error("Error processing charge success event:", err.message);
  }
};

const handleChargeFailed = async (event) => {
  const paymentData = event.data;
  console.log("Handling charge failed:");

  try {
    // Find the payment record by reference, starting with paymentModel
    let paymentRecord = await paymentModel.findOne({
      reference: paymentData.reference,
    });

    // If not found in paymentModel, search in transactionModel
    if (!paymentRecord) {
      paymentRecord = await transactionModel.findOne({
        reference: paymentData.reference,
      });
    }

    // If no payment record is found in either model, log and exit
    if (!paymentRecord) {
      console.error(
        "Payment record not found for reference:",
        paymentData.reference
      );
      return;
    }

    // Update the payment status to "failed"
    paymentRecord.status = "failed";
    await paymentRecord.save();

    // Fetch the merchant based on the payment record's merchant ID
    const merchant = await merchantModel.findById(paymentRecord.merchant);
    if (!merchant) {
      console.error("Merchant not found for payment:", paymentRecord.merchant);
      return;
    }

    // Push the transaction reference into transactionHistory
    merchant.transactionHistory.push({
      reference: paymentRecord.reference,
      amount: paymentRecord.amount,
      status: paymentRecord.status,
      type: paymentRecord.type || "charge", // Set type as 'charge' by default
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
    });

    // Push the notification message into the notification array
    const notifyMsg = {
      notificationMessage: `Payment of ${paymentRecord.amount} ${paymentRecord.currency} has failed. Reference: ${paymentRecord.reference}. \n\n PayWave Team`,
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
    };
    merchant.notification.push(notifyMsg);
    await merchant.save();

    // Notify merchant via email about the failed payment
    await sendEmailNotification(
      merchant.email,
      "Payment Failed",
      `Customer payment of ${paymentRecord.amount} ${paymentRecord.currency} has failed. Reference: ${paymentRecord.reference}. \n\n PayWave Team`
    );

    notificationModel.create({
      merchant: merchant._id,
      email: merchant.email,
      subject: "Payment failed",
      message: `Payment of ${paymentRecord.amount} ${paymentRecord.currency} has failed. Reference: ${paymentRecord.reference}. \n\n PayWave Team`,
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
    });

    console.log("Payment failure handled successfully!");
  } catch (err) {
    console.error("Error handling charge failure:", err.message);
  }
};

const handleTransferSuccess = async (event) => {
  const transferData = event.data;
  console.log("Handling transfer success:");

  try {
    // Check if it's a withdrawal event by searching in the withdrawModel
    const withdrawal = await withdrawModel.findOne({
      reference: transferData.reference,
    });

    if (withdrawal) {
      // Update the withdrawal status to 'success'
      withdrawal.status = "success";
      await withdrawal.save();

      // Fetch the merchant and deduct the amount from their balance
      const merchant = await merchantModel.findById(withdrawal.merchant);
      if (merchant) {
        merchant.balance -= withdrawal.amount;

        // Push the transaction into the merchant's transactionHistory
        merchant.transactionHistory.push({
          reference: withdrawal.reference,
          amount: withdrawal.amount,
          status: "success",
          type: "withdrawal",
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString(),
        });

        // Push the notification message into the merchant's notification array
        merchant.notification.push({
          notificationMessage: `Your withdrawal of ${withdrawal.amount} ${withdrawal.currency} was successful. Reference: ${withdrawal.reference}.`,
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString(),
        });

        await merchant.save();

        // Notify merchant via email about the successful withdrawal
        await sendEmailNotification(
          merchant.email,
          "Withdrawal Successful",
          `Your withdrawal of ${withdrawal.amount} ${withdrawal.currency} was successful. Transfer reference: ${withdrawal.reference}.`
        );

        // Create a notification record in the notificationModel
        await notificationModel.create({
          merchant: merchant._id,
          email: merchant.email,
          subject: "Withdrawal Successful",
          message: `Your withdrawal of ${withdrawal.amount} ${withdrawal.currency} was successful. Reference: ${withdrawal.reference}.`,
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString(),
        });

        console.log(
          `Withdrawal ${transferData.reference} successful and processed.`
        );
      } else {
        console.error(
          "Merchant not found for withdrawal:",
          withdrawal.merchant
        );
        return;
      }
    } else {
      // If it's not a withdrawal, handle other transfer successes (e.g., transfer related to payments)
      const paymentRecord = await paymentModel.findOne({
        reference: transferData.reference,
      });

      if (paymentRecord) {
        // Update the payment status to 'success'
        paymentRecord.status = "success";
        await paymentRecord.save();

        const merchant = await merchantModel.findById(paymentRecord.merchant);
        if (merchant) {
          // Push the transaction into the merchant's transactionHistory
          merchant.transactionHistory.push({
            reference: paymentRecord.reference,
            amount: paymentRecord.amount,
            status: "success",
            type: "payment",
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
          });

          // Push the notification message into the merchant's notification array
          merchant.notification.push({
            notificationMessage: `Your transfer of ${paymentRecord.amount} ${paymentRecord.currency} was successful. Reference: ${paymentRecord.reference}. \n\n PayWave Team`,
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
          });

          await merchant.save();

          // Notify merchant via email
          await sendEmailNotification(
            merchant.email,
            "Payment Transfer Successful",
            `Your transfer of ${paymentRecord.amount} ${paymentRecord.currency} was successful. Transfer reference: ${paymentRecord.reference}. \n\n PayWave Team`
          );

          // Create a notification record in the notificationModel
          await notificationModel.create({
            merchant: merchant._id,
            email: merchant.email,
            subject: "Payment Successful",
            message: `Payment of ${paymentRecord.amount} ${paymentRecord.currency} was successful. Reference: ${paymentRecord.reference}. \n\n PayWave Team`,
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
          });

          console.log("Payment transfer success handled successfully!");
        } else {
          console.error(
            "Merchant not found for payment transfer:",
            paymentRecord.merchant
          );
        }
      } else {
        console.error(
          "No withdrawal or payment record found for reference:",
          transferData.reference
        );
      }
    }
  } catch (err) {
    console.error("Transfer Success Handling Error:", err.message);
  }
};


const handleTransferFailed = async (event) => {
  const transferData = event.data;
  console.log("Handling transfer failure:");

  try {
    // Check if it's a withdrawal event by searching in the withdrawModel
    const withdrawal = await withdrawModel.findOne({
      reference: transferData.reference,
    });

    if (withdrawal) {
      // Update the withdrawal status to 'failed'
      withdrawal.status = "failed";
      await withdrawal.save();

      // Fetch the merchant associated with the withdrawal
      const merchant = await merchantModel.findById(withdrawal.merchant);
      if (merchant) {
        // Push the notification message into the merchant's notification array
        merchant.notification.push({
          notificationMessage: `Your withdrawal of ${withdrawal.amount} ${withdrawal.currency} has failed. Reference: ${withdrawal.reference}.`,
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString(),
        });

        // Push the transaction into the merchant's transactionHistory
        merchant.transactionHistory.push({
          reference: withdrawal.reference,
          amount: withdrawal.amount,
          status: "failed",
          type: "transfer",
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString(),
        });

        await merchant.save();

        // Notify merchant via email about the failed withdrawal
        await sendEmailNotification(
          merchant.email,
          "Withdrawal Failed",
          `Your withdrawal of ${withdrawal.amount} ${withdrawal.currency} has failed. Reference: ${withdrawal.reference}.`
        );

        // Create a notification record in the notificationModel
        await notificationModel.create({
          merchant: merchant._id,
          email: merchant.email,
          subject: "Withdrawal Failed",
          message: `Your withdrawal of ${withdrawal.amount} ${withdrawal.currency} has failed. Reference: ${withdrawal.reference}.`,
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString(),
        });

        console.log(
          `Withdrawal ${transferData.reference} failed and processed.`
        );
      } else {
        console.error(
          "Merchant not found for withdrawal:",
          withdrawal.merchant
        );
        return;
      }
    } else {
      // If it's not a withdrawal, handle other transfer failures (e.g., payment related)
      const paymentRecord = await paymentModel.findOne({
        reference: transferData.reference,
      });

      if (paymentRecord) {
        // Update the payment status to 'failed'
        paymentRecord.status = "failed";
        await paymentRecord.save();

        const merchant = await merchantModel.findById(paymentRecord.merchant);
        if (merchant) {
          // Push the notification message into the merchant's notification array
          merchant.notification.push({
            notificationMessage: `Payment of ${paymentRecord.amount} ${paymentRecord.currency} has failed. Reference: ${paymentRecord.reference}. \n\n PayWave Team`,
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
          });

          // Push the transaction into the merchant's transactionHistory
          merchant.transactionHistory.push({
            reference: paymentRecord.reference,
            amount: paymentRecord.amount,
            status: "failed",
            type: "transfer",
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
          });

          await merchant.save();

          // Notify merchant via email
          await sendEmailNotification(
            merchant.email,
            "Payment Transfer Failed",
            `Payment of ${paymentRecord.amount} ${paymentRecord.currency} has failed. Reference: ${paymentRecord.reference}. \n\n PayWave Team`
          );

          // Create a notification record in the notificationModel
          await notificationModel.create({
            merchant: merchant._id,
            email: merchant.email,
            subject: "Payment Failed",
            message: `Payment of ${paymentRecord.amount} ${paymentRecord.currency} has failed. Reference: ${paymentRecord.reference}. \n\n PayWave Team`,
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
          });

          console.log("Payment transfer failure handled successfully!");
        } else {
          console.error(
            "Merchant not found for payment transfer:",
            paymentRecord.merchant
          );
        }
      } else {
        console.error(
          "No withdrawal or payment record found for reference:",
          transferData.reference
        );
      }
    }
  } catch (err) {
    console.error("Transfer Failure Handling Error:", err.message);
  }
};

// Helper function to handle payout
const processPayout = async (payoutPayload) => {
  try {
    const korapayResponse = await axios.post(
      `${KORAPAY_API_BASE_URL}/merchant/api/v1/transactions/disburse`,
      payoutPayload,
      {
        headers: {
          Authorization: `Bearer ${process.env.KORAPAY_SECRET_KEY}`,
        },
      }
    );
    return korapayResponse.data;
  } catch (error) {
    console.error("Payout API Error:", error.response?.data || error.message);
    return { success: false, message: "Failed to disburse payment." };
  }
};
