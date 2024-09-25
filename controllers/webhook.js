const crypto = require("crypto");
const paymentModel = require("../models/paymentModel");
const merchantModel = require("../models/merchantModel");
const withdrawModel = require("../models/withdrawModel");
const notificationModel = require("../models/notificationModel");
const sendEmailNotification = require("../utils/emailNotification");
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

    console.log("Req Body Data:", req.body.data);
    console.log("Korapay Secret Key:", KORAPAY_SECRET_KEY);
    console.log("Expected Hash:", hash);
    console.log("Received Signature:", korapaySignature);

    // Compare the computed hash with the signature from the headers
    if (hash !== korapaySignature) {
      console.error("Invalid signature:", { expected: hash, received: korapaySignature });
      // return res.status(400).send({ error: "Invalid signature" });
    }

    // Parse the event
    const event = req.body;

    // Prevent duplicate event processing (check by transaction reference)
    const existingEvent = await paymentModel.findOne({ reference: event.data.reference });
    const existingEventW = await withdrawModel.findOne({ reference: event.data.reference });

    if (
      (existingEvent && existingEvent.status === event.data.status) || 
      (existingEventW && existingEventW.status === event.data.status)
    ) {
      console.log(`Event with reference ${event.data.reference} already processed.`);
      // return res.status(200).json({ message: "Event already processed" });
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
  console.log("Handling charge success:", paymentData);

  try {
    // Update the payment status for successful payments
    const paymentRecord = await paymentModel.findOne({
      reference: paymentData.reference,
    });
    if (paymentRecord) {
      paymentRecord.status = "success";
      await paymentRecord.save();

      // Update the merchant wallet balance
      const merchant = await merchantModel.findById(paymentRecord.merchant);
      if (!merchant) {
        console.error(
          "Merchant not found for payment:",
          paymentRecord.merchant
        );
        return;
      }
      // Payout to the merchant's Korapay virtual account
      const payoutPayload = {
        destination: {
          amount: paymentRecord.amount, // Amount to be transferred
          currency: "NGN",
          type: "bank_account",
          bank_account: {
            account_number: merchant.bankAccountDetails.accountNumber,
            bank_code: merchant.bankAccountDetails.bankCode,
            account_name: merchant.bankAccountDetails.accountName,
          },
          narration: `Disbursement of ${paymentRecord.amount} NGN to ${merchant.name}`,
        },
        reference: `PAYOUT_${paymentRecord.reference}`,
      };

      // Separate payout logic in a function
      const payoutResult = await processPayout(payoutPayload);
      if (payoutResult.success) {
        console.log(
          `Successfully disbursed ${paymentRecord.amount} to merchant ${merchant._id}`
        );
      }

      merchant.balance += paymentRecord.amount;
      (paymentRecord.eventId = event.id), await merchant.save();
      await paymentRecord.save();

      // // Update the admin's commission earned
      // const admin = await adminModel.findOne({ email: 'info@vadtrans.com.ng' });
      // if (admin) {
      //     admin.commissionEarned += paymentRecord.commission;
      //     await admin.save();
      // }
    }

    // Notify merchant via email
    await sendEmailNotification(
      merchant.email,
      "Payment Successful",
      `Customer payment of ${paymentRecord.amount} ${paymentRecord.currency} was successful. Reference: ${paymentRecord.reference}. \n\n PayWave Team`
    );

    const notify = await notificationModel.create({
      merchant: merchant._id,
      email: merchant.email,
      subject: "Payment Successful",
      message: `Payment of ${paymentRecord.amount} ${paymentRecord.currency} was successful. Reference: ${paymentRecord.reference}. \n\n PayWave Team`,
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
    });

    console.log("Payment verification completed successfully!");
  } catch (err) {
    console.error("Error saving transaction:", err.message);
  }
};

const handleChargeFailed = async (event) => {
  const paymentData = event.data;
  console.log("Handling charge failed:", paymentData);

  try {
    // Update the payment status for successful payments
    const paymentRecord = await paymentModel.findOne({
      reference: paymentData.reference,
    });
    if (paymentRecord) {
      paymentRecord.status = "failed";
      await paymentRecord.save();
    }

    const merchant = await merchantModel.findOne({
      email: paymentRecord.email,
    });
    if (!merchant) {
      console.error("merchant not found for payment:", paymentRecord.email);
      return;
    }

    // Notify merchant via email
    await sendEmailNotification(
      merchant.email,
      "Payment Failed",
      `Customer payment of ${paymentRecord.amount} ${paymentRecord.currency} has failed. Reference: ${paymentRecord.reference}. \n\n PayWave team`
    );

    console.log("Payment failure handled successfully!");
  } catch (err) {
    console.error("Error saving transaction:", err.message);
  }
};

// const handleTransferSuccess = async (event) => {
//     const transferData = event.data;
//     console.log('Handling transfer success:', transferData);

//     try {
//         // Check if it's a withdrawal event
//         const withdrawal = await withdrawalModel.findOne({ transferId: transferData.transfer_code });
//         if (withdrawal) {
//             // Update the withdrawal status to 'completed'
//             withdrawal.status = 'completed';
//             await withdrawal.save();

//             // Deduct the amount from the company's wallet balance
//             const transCompany = await transCompanyModel.findById(withdrawal.transCompany);
//             transCompany.walletBalance -= withdrawal.amount;
//             await transCompany.save();

//             // Notify merchant via email
//             await sendEmailNotification(
//                 withdrawal.email,
//                 'Transfer Successful',
//                 `Your transfer of ${withdrawal.amount} ${withdrawal.currency} was successful. Transfer Code: ${withdrawal.reference}.`
//             );

//             console.log(`Withdrawal ${transferData.transfer_code} successful and processed.`);
//         } else {
//             // Handle other transfer successes ( transfer related to payments )
//             const paymentRecord = await paymentModel.findOne({ reference: transferData.reference });
//             if (paymentRecord) {
//                 paymentRecord.status = 'success';
//                 await paymentRecord.save();

//                 const merchant = await merchantModel.findOne({ email: paymentRecord.email });
//                 if (merchant) {
//                     // Notify merchant via email
//                     await sendEmailNotification(
//                         merchant.email,
//                         'Transfer Successful',
//                         `Your transfer of ${paymentRecord.amount} ${paymentRecord.currency} was successful. Transfer Code: ${paymentRecord.reference}. \n\n PayWave team`
//                     );
//                 }

//                 console.log('Transfer success handled successfully!');
//             }
//         }
//     } catch (err) {
//         console.error('Transfer Success Handling Error: ', err.message);
//     }
// };

// const handleTransferFailed = async (event) => {
//     const transferData = event.data;
//     console.log('Handling transfer failure:', transferData);

//     try {
//         const withdrawal = await withdrawalModel.findOne({ transferId: transferData.transfer_code });
//         if (withdrawal) {
//             // Update the withdrawal status to 'failed'
//             withdrawal.status = 'failed';
//             await withdrawal.save();

//             // Notify merchant via email
//             await sendEmailNotification(
//                 withdrawal.email,
//                 'Transfer Failed',
//                 `Your transfer of ${withdrawal.amount} ${withdrawal.currency} has failed. Transfer Code: ${withdrawal.reference}.`
//             );

//             console.log(`Withdrawal ${transferData.transfer_code} failed and processed.`);
//         } else {
//             const paymentRecord = await paymentModel.findOne({ reference: transferData.reference });
//             if (paymentRecord) {
//                 paymentRecord.status = 'failed';
//                 await paymentRecord.save();

//                 const merchant = await merchantModel.findOne({ email: paymentRecord.email });
//                 if (merchant) {
//                     await sendEmailNotification(
//                         merchant.email,
//                         'Transfer Failed',
//                         `Your transfer of ${paymentRecord.amount} ${paymentRecord.currency} has failed. Transfer Code: ${paymentRecord.reference}.`
//                     );
//                 }

//                 console.log('Transfer failure handled successfully!');
//             }
//         }
//     } catch (err) {
//         console.error('Transfer Failure Handling Error: ', err.message);
//     }
// };

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
