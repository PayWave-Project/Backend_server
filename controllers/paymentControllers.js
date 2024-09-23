const paymentModel = require('../models/paymentModel');
const merchantModel = require('../models/merchantModel');
const axios = require('axios');
const QRCode = require('qrcode');
require('dotenv').config();

const KORAPAY_SECRET_KEY = process.env.KORAPAY_SECRET_KEY;
const KORAPAY_API_URL = process.env.KORAPAY_API_URL;

// Check if Korapay credentials are available
if (!KORAPAY_SECRET_KEY || !KORAPAY_API_URL ) {
  throw new Error("Korapay API credentials are missing in the environment variables.")
}

exports.generateQRCode = async (req, res) => {
  try {
    const { userId } = req.user;
    const { merchantId, email, amount } = req.body;

    // Validate request body
    if (!merchantId || !email || !amount) {
      return res.status(400).json({ message: "Invalid request body" });
    }

    // Fetch merchant info
    const merchant = await merchantModel.findById(userId);
    if (!merchant) {
      return res.status(404).json({ message: "Merchant not found" });
    }

    // Set expiration time
    const expirationTime = new Date();
    // expirationTime.setHours(expirationTime.getHours() + 1); // TTL: 1 hour
    expirationTime.setMinutes(expirationTime.getMinutes() + 10); // TTL: 5 Minutes

    // Create payment entry
    const newPayment = new paymentModel({
      merchant: merchant._id,
      email,
      merchantId,
      amount,
      currency: "NGN",
      status: 'pending',
      reference: `PYW-${Date.now()}`,
      expiresAt: expirationTime,
    });

    await newPayment.save();

    // Prepare data for Korapay API
    const paymentData = {
      amount: amount,
      redirect_url: "https://korapay.com",
      currency: "NGN",
      reference: newPayment.reference,
      narration: "Payment for product Y",
      channels: ["card", "bank_transfer", "pay_with_bank"],
      default_channel: "pay_with_bank",
      customer: { email: email },
      notification_url: "https://paywave-api-psi.vercel.app/api/v1/webhook",
      metadata: {
        key0: "test0",
      }
    };

    if (!paymentData) {
      return res.status(400).json({ message: "Invalid payment data" })
    }


    // Request Korapay to initiate the payment
    const korapayResponse = await axios.post(
      `${KORAPAY_API_URL}/initialize`,
      paymentData,
      {
        headers: {
          'Authorization': `Bearer ${KORAPAY_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

        // Validate Korapay response structure
        if (!korapayResponse.data || !korapayResponse.data.data || !korapayResponse.data.data.checkout_url) {
          return res.status(500).json({
            message: "Invalid Korapay API response format",
            API_Error: korapayResponse.data || "No additional error details from API"
          });
        }

    // Validate Korapay response and extract the checkout URL
    const { data } = korapayResponse.data || {};
    if (!data || !data.checkout_url) {
      return res.status(500).json({
        message: "Invalid Korapay API response",
        API_Error: korapayResponse.data || "No additional error details from API",
      });
    }

    const { checkout_url } = data;

    // Save the checkout URL in the new payment
    newPayment.checkout_url = checkout_url;
      paymentData.checkout_url = checkout_url;

    // Generate QR code for the scan endpoint instead of Korapay checkout URL directly
    const scanUrl = `${req.protocol}://${req.get('host')}/api/v1/scan/${newPayment.reference}`;
    const qrCodeDataURL = await QRCode.toDataURL(scanUrl);

    await newPayment.save();
    // Send QR code and payment URL as response
    return res.status(201).json({
      message: "QR Payment successfully generated!",
      qrCode: qrCodeDataURL,
      paymentUrl: checkout_url,
    });
  } catch (error) {
    // console.error(error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      API_Error: error.response?.data || "No additional error details from API"
    });
  }
};



//Endpoint to check if the QR Code is valid and still pending
exports.scanQRCode = async (req, res) => {
  try {
    const { reference } = req.params;
    
    console.log("Refence from params: " + reference);

    // Find the payment by reference
    const payment = await paymentModel.findOne({ reference: reference });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Check if the payment has expired
    const currentTime = new Date();
    if (payment.expiresAt < currentTime) {
      return res.status(400).json({
        message: "QR Code has expired",
        expired: true,
      });
    }

    // Check if the payment is already completed
    if (payment.status === 'success') {
      return res.status(200).json({
        message: "Payment has already been completed",
        completed: true,
      });
    }

    // If payment is valid and still pending, redirect to the checkout_url
    return res.redirect(payment.checkout_url);
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};




exports.testKoraPay = async (req, res) => {
  try {
    const KORAPAY_SECRET_KEY = process.env.KORAPAY_SECRET_KEY;
    const KORAPAY_API_URL = process.env.KORAPAY_API_URL;

    // Check if Korapay credentials are available
    if (!KORAPAY_SECRET_KEY || !KORAPAY_API_URL) {
      return res.status(500).json({
        message: "Korapay API credentials are missing in the environment variables."
      });
    }

    // Prepare data for Korapay API
    const paymentData = {
      amount: 1000,
      redirect_url: "https://korapay.com",
      currency: "NGN",
      reference: `REF-${Date.now()}`,
      narration: "Payment for product Y",
      channels: ["card", "bank_transfer"],
      default_channel: "card",
      merchant_bears_cost: false,
      customer: {
        name: "John Doe",
        email: "john@email.com"
      },
      notification_url: "https://paywave-api-psi.vercel.app/api/v1/webhook",
      metadata: {
        key0: "test0",
      }
    };

    // Make request to Korapay to initiate the payment
    const korapayResponse = await axios.post(
      KORAPAY_API_URL,
      paymentData,
      {
        headers: {
          Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Validate Korapay response structure
    if (!korapayResponse.data || !korapayResponse.data.data || !korapayResponse.data.data.checkout_url) {
      return res.status(500).json({
        message: "Invalid Korapay API response format",
        API_Error: korapayResponse.data || "No additional error details from API"
      });
    }

    // Extract payment URL
    const { checkout_url } = korapayResponse.data.data;

    // Ensure payment_url is a valid string
    if (typeof checkout_url !== 'string' || !checkout_url) {
      return res.status(500).json({
        message: "Invalid payment URL returned from Korapay",
        checkout_url,
      });
    }

    // Generate QR code for the payment URL
    const qrCodeDataURL = await QRCode.toDataURL(checkout_url);

    // Send QR code and payment URL as response
    return res.status(201).json({
      message: "QR Payment successfully generated!",
      qrCode: qrCodeDataURL,
      paymentUrl: checkout_url,
    });

  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      API_Error: error.response?.data || "No additional error details from API"
    });
  }
};



// New endpoint for payment confirmation
exports.confirmPayment = async (req, res) => {
  const { reference } = req.body;

  if (!reference) {
      return res.status(400).send({ error: 'Missing reference' });
  }

  try {
      // Verify the KoraPay payment
      const response = axios.get(`${KORAPAY_API_URL}/${reference}`, {}, {
        headers: {
          Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const paymentData = response.data;

      if (paymentData.data.status !== 'success') {
          return res.status(400).send({ error: 'Payment verification failed' });
      }

      // Update the payment status for successful payments
      const paymentRecord = await paymentModel.findOne({ reference: paymentData.data.reference });
      if (paymentRecord) {
          paymentRecord.status = 'success';
          await paymentRecord.save();
      }

      // Payment was successful, return a success response
      return res.status(200).json({
          message: "Payment successful! Verification complete",
          paymentData: paymentData
      });
  } catch (error) {
      console.error('Error confirming payment:', error.message);
      return res.status(500).send({ error: error.message });
  }
};