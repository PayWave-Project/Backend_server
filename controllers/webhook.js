const crypto = require('crypto');
const paymentModel = require('../models/paymentModel');
const merchantModel = require('../models/merchantModel');
const notificationModel = require('../models/notificationModel');
const sendEmailNotification = require('../utils/emailNotification');
require('dotenv').config();



const KORAPAY_SECRET_KEY = process.env.KORAPAY_SECRET_KEY;

// Webhook Endpoint
exports.webhook = async (req, res) => {
    try {
        const korapaySignature = req.headers['x-korapay-signature'];

        // Access the raw body
        const rawBody = req.rawBody;

        // Check if rawBody is a buffer
        if (!Buffer.isBuffer(rawBody)) {
            console.error('Raw body is not a buffer');
            return res.status(400).send({ error: 'Raw body is not a buffer' });
        }

        // Compute the hash for verification
        const hash = crypto
            .createHmac('sha512', KORAPAY_SECRET_KEY)
            .update(rawBody)
            .digest('hex');

        // Compare computed hash with the Paystack signature
        if (hash !== korapaySignature) {
            console.error('Invalid signature:', {
                expected: hash,
                received: korapaySignature,
            });
            return res.status(400).send({ error: 'Invalid signature' });
        }

        // Parse the raw body into JSON
        const event = JSON.parse(rawBody.toString());

        switch (event.event) {
            case 'charge.success':
                await handleChargeSuccess(event);
                break;
            case 'charge.failed':
                await handleChargeFailed(event);
                break;
            case 'charge.dispute':
                await handleChargeDispute(event);
                break;
            case 'charge.refund':
                await handleChargeRefund(event);
                break;
            case 'transfer.success':
                await handleTransferSuccess(event);
                break;
            case 'transfer.failed':
                await handleTransferFailed(event);
                break;
            default:
                console.log(`Unhandled event type ${event.event}`);
                break;
        }

        // Respond with 200 OK to acknowledge receipt of the event
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
    console.log('Handling charge success:', paymentData);

    try {
        // Update the payment status for successful payments
        const paymentRecord = await paymentModel.findOne({ reference: paymentData.reference });
        if (paymentRecord) {
            paymentRecord.status = 'success';
            await paymentRecord.save();

            // Update the merchant wallet balance
            const merchant = await merchantModel.findById(paymentRecord.merchant);
            if (merchant) {
                merchant.balance += paymentRecord.amount;
                await merchant.save();
            }

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
            'Payment Successful',
            `Your payment of ${paymentRecord.amount} ${paymentRecord.currency} was successful. Reference: ${paymentRecord.reference}. \n\n PayWave Team`
        );

        const notify = await notificationModel.create({
            merchant: merchant._id,
            email: merchant.email,
            subject: 'Payment Successful',
            message: `Payment of ${paymentRecord.amount} ${paymentRecord.currency} was successful. Reference: ${paymentRecord.reference}. \n\n PayWave Team`,
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
        })

        console.log('Payment verification completed successfully!');
    } catch (err) {
        console.error('Error saving transaction:', err.message);
    }
};


const handleChargeFailed = async (event) => {
    const paymentData = event.data;
    console.log('Handling charge failed:', paymentData);

    try {
        // Update the payment status for successful payments
        const paymentRecord = await paymentModel.findOne({ reference: paymentData.reference });
        if (paymentRecord) {
            paymentRecord.status = 'failed';
            await paymentRecord.save();
        }

        const merchant = await merchantModel.findOne({ email: paymentRecord.email });
        if (!merchant) {
            console.error('merchant not found for payment:', paymentRecord.email);
            return;
        }

        // Notify merchant via email
        await sendEmailNotification(
            merchant.email,
            'Payment Failed',
            `Your payment of ${paymentRecord.amount} ${paymentRecord.currency
            } has failed. Reference: ${paymentRecord.reference}. \n\n PayWave team`
        );

        console.log('Payment failure handled successfully!');
    } catch (err) {
        console.error('Error saving transaction:', err.message);
    }
};

const handleChargeDispute = async (event) => {
    const disputeData = event.data;
    console.log('Handling charge dispute:', disputeData);

    try {
        // Update the payment status for successful payments
        const paymentRecord = await paymentModel.findOne({ reference: disputeData.reference });
        if (paymentRecord) {
            paymentRecord.status = 'dispute';
            await paymentRecord.save();
        }

        const merchant = await merchantModel.findOne({ email: paymentRecord.email });
        if (!merchant) {
            console.error('merchant not found for dispute:', paymentRecord.email);
            return;
        }

        // Notify merchant via email
        await sendEmailNotification(
            merchant.email,
            'Charge Disputed',
            `A dispute has been raised on your payment of ${paymentRecord.amount} ${paymentRecord.currency
            }. Reference: ${paymentRecord.reference}. Please contact support for more details.  \n\n PayWave team`
        );

        console.log('Charge dispute handled successfully!');
    } catch (err) {
        console.error('Error saving dispute:', err.message);
    }
};

const handleChargeRefund = async (event) => {
    const refundData = event.data;
    console.log('Handling charge refund:', refundData);

    try {
        // Update the payment status for successful payments
        const paymentRecord = await paymentModel.findOne({ reference: refundData.reference });
        if (paymentRecord) {
            paymentRecord.status = 'refund';
            await paymentRecord.save();
        }

        const merchant = await merchantModel.findOne({ email: paymentRecord.email });
        if (!merchant) {
            console.error('merchant not found for refund:', paymentRecord.email);
            return;
        }

        // Notify merchant via email
        await sendEmailNotification(
            merchant.email,
            'Refund Processed',
            `Your payment of ${paymentRecord.amount} ${paymentRecord.currency
            } has been refunded. Reference: ${paymentRecord.reference}. \n\n PayWave team`
        );

        console.log('Charge refund handled successfully!');
    } catch (err) {
        console.error('Error saving refund:', err.message);
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