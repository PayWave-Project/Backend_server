const crypto = require("crypto");
const paymentModel = require("../models/paymentModel");
const merchantModel = require("../models/merchantModel");
const withdrawModel = require("../models/withdrawModel");
const transactionModel = require("../models/transactionModel");
const notificationModel = require("../models/notificationModel");
const sendEmailNotification = require("../utils/emailNotification");
const { notificationEmail } = require("../utils/notificationEmailTemplate");
const axios = require("axios");
require("dotenv").config();

const KORAPAY_SECRET_KEY = process.env.KORAPAY_SECRET_KEY;
const platformCommissionRate = 0.15;

// Webhook Endpoint
exports.webhook = async (req, res) => {
  try {
    const korapaySignature = req.headers["x-korapay-signature"];

    // Verify the presence of the signature
    if (!korapaySignature) {
      return res.status(400).send({ error: "Missing signature" });
    }

    // Hash the `data` object from the request payload with the Korapay secret key
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
      status: "success",
    });
    const existingEventW = await withdrawModel.findOne({
      reference: event.data.reference,
      status: "success",
    });
    const existingEventT = await transactionModel.findOne({
      reference: event.data.reference,
      status: "success",
    });

    if (existingEvent || existingEventW || existingEventT) {
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

    // //Calculation of the merchant balance after platform commission deduction
    // const netAmount = paymentRecord.amount * (1 - platformCommissionRate);
    // merchant.balance += netAmount;

    // Add the payment amount to the merchant's balance
    merchant.balance += paymentRecord.amount;

    // Push the transaction reference into transactionHistory
    merchant.transactionHistory.push({
      reference: paymentRecord.reference,
      amount: paymentRecord.amount,
      status: paymentRecord.status,
      type: paymentRecord.type || "charge",
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

    const emailBody = `Customer payment of ${paymentRecord.amount} ${paymentRecord.currency} was successful. Reference: ${paymentRecord.reference}. \n\n PayWave Team`;
const recipients = [merchant.email, paymentRecord.email];

try {
  for (const recipient of recipients) {
    const emailHTML = notificationEmail(recipient, emailBody);

    await sendEmailNotification({
      email: recipient,
      subject: "Payment Successful",
      html: emailHTML,
    });
  }

  // Create notification record for the merchant
  await notificationModel.create({
    merchant: merchant._id,
    email: paymentRecord.email,
    subject: "Payment Successful",
    message: emailBody,
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
  });

} catch (error) {
  console.error(`Failed to send email to ${recipients.join(', ')}:`, error.message);
}

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
      type: paymentRecord.type || "charge",
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

    const failedEmailBody = `Customer payment of ${paymentRecord.amount} ${paymentRecord.currency} has failed. Reference: ${paymentRecord.reference}. \n\n PayWave Team`;
const recipients = [merchant.email, paymentRecord.email];

try {
  for (const recipient of recipients) {
    const emailHTML = notificationEmail(recipient, failedEmailBody);

    await sendEmailNotification({
      email: recipient,
      subject: "Payment Failed",
      html: emailHTML,
    });
  }

  // Create notification record for the merchant
  await notificationModel.create({
    merchant: merchant._id,
    email: paymentRecord.email, 
    subject: "Payment Failed",
    message: failedEmailBody,
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
  });

} catch (error) {
  console.error(`Failed to send email to ${recipients.join(', ')}:`, error.message);
}

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
        // //Calculation of the merchant balance after platform commission deduction
        // const netAmount = paymentRecord.amount * (1 - platformCommissionRate);
        // merchant.balance -= netAmount;

        if (merchant.balance >= withdrawal.amount) {
          merchant.balance -= withdrawal.amount;
        } else {
          console.log("Insufficient balance");
        }

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

        // Define the recipient and email body content for the successful payment transfer
        const recipient = merchant.email;
        const body = `Your withdrawal of ${withdrawal.amount} ${withdrawal.currency} was successful. wWthdrawal reference: ${withdrawal.reference}. \n\n PayWave Team`;

        // Generate the HTML content for the email
        const emailHTML = notificationEmail(recipient, body);

        // Notify the merchant via email with the HTML content
        await sendEmailNotification({
          email: recipient,
          subject: "Withdrawal Successful",
          html: emailHTML,
        });

        // Create a notification record in the notificationModel
        await notificationModel.create({
          merchant: merchant._id,
          email: recipient,
          subject: "Withdrawal Successful",
          message: body,
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
      const paymentRecord = await transactionModel.findOne({
        reference: transferData.reference,
      });

      if (paymentRecord) {
        // Update the payment status to 'success'
        paymentRecord.status = "success";
        await paymentRecord.save();

        const merchant = await merchantModel.findById(paymentRecord.merchant);
        if (merchant) {
          // //Calculation of the merchant balance after platform commission deduction
          // const netAmount = paymentRecord.amount * (1 - platformCommissionRate);
          // merchant.balance -= netAmount;

          if (merchant.balance >= paymentRecord.amount) {
            merchant.balance -= paymentRecord.amount;
          } else {
            console.log("Insufficient balance");
          }

          // Push the transaction into the merchant's transactionHistory
          merchant.transactionHistory.push({
            reference: paymentRecord.reference,
            amount: paymentRecord.amount,
            status: "success",
            type: "transfer",
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

          // Define the recipient and email body content for the successful payment transfer
          const recipient = merchant.email;
          const body = `Your transfer of ${paymentRecord.amount} ${paymentRecord.currency} was successful. Transfer reference: ${paymentRecord.reference}. \n\n PayWave Team`;

          // Generate the HTML content for the email
          const emailHTML = notificationEmail(recipient, body);

          // Notify the merchant via email with the HTML content
          await sendEmailNotification({
            email: recipient,
            subject: "Transfer Successful",
            html: emailHTML,
          });

          // Create a notification record in the notificationModel
          await notificationModel.create({
            merchant: merchant._id,
            email: recipient,
            subject: "Transfer Successful",
            message: body,
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

        // Define the recipient and email body content for the successful payment transfer
        const recipient = merchant.email;
        const body = `Your withdrawal of ${withdrawal.amount} ${withdrawal.currency} has failed. wWthdrawal reference: ${withdrawal.reference}. \n\n PayWave Team`;

        // Generate the HTML content for the email
        const emailHTML = notificationEmail(recipient, body);

        // Notify the merchant via email with the HTML content
        await sendEmailNotification({
          email: recipient,
          subject: "Withdrawal Failed",
          html: emailHTML,
        });

        // Create a notification record in the notificationModel
        await notificationModel.create({
          merchant: merchant._id,
          email: recipient,
          subject: "Withdrawal Failed",
          message: body,
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
      const paymentRecord = await transactionModel.findOne({
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
            notificationMessage: `Your transfer of ${paymentRecord.amount} ${paymentRecord.currency} has failed. Reference: ${paymentRecord.reference}. \n\n PayWave Team`,
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

          // Define the recipient and email body content for the successful payment transfer
          const recipient = merchant.email;
          const body = `Your transfer of ${paymentRecord.amount} ${paymentRecord.currency} has failed. Transfer reference: ${paymentRecord.reference}. \n\n PayWave Team`;

          // Generate the HTML content for the email
          const emailHTML = notificationEmail(recipient, body);

          // Notify the merchant via email with the HTML content
          await sendEmailNotification({
            email: recipient,
            subject: "Transfer Failed",
            html: emailHTML,
          });

          // Create a notification record in the notificationModel
          await notificationModel.create({
            merchant: merchant._id,
            email: recipient,
            subject: "Transfer Failed",
            message: body,
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
