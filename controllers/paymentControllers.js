const paymentModel = require("../models/paymentModel");
const merchantModel = require("../models/merchantModel");
const axios = require("axios");
const QRCode = require("qrcode");
require("dotenv").config();

const KORAPAY_API_BASE_URL = process.env.KORAPAY_API_BASE_URL;
const KORAPAY_SECRET_KEY = process.env.KORAPAY_SECRET_KEY;
const KORAPAY_API_URL = process.env.KORAPAY_API_URL;

if (!KORAPAY_SECRET_KEY || !KORAPAY_API_URL) {
  throw new Error(
    "Korapay API credentials are missing in the environment variables."
  );
}

exports.generateQRCode = async (req, res) => {
  try {
    const { userId } = req.user;
    const { email, amount, type, duration } = req.body;
    if (type === "dynamic" || type === "static_defined") {
      if (!email || !amount || !type) {
        return res.status(400).json({ message: "Invalid request body" });
      }
    }

    const merchant = await merchantModel.findById(userId);
    if (!merchant) {
      return res.status(404).json({ message: "Merchant not found" });
    }

    const expirationTime =
      type === "dynamic"
        ? new Date(new Date().getTime() + Number(duration) * 60000)
        : null;

    const newPayment = new paymentModel({
      merchant: merchant._id,
      email,
      merchantId: merchant.merchantId,
      amount: type === 'static_custom' ? 100 : amount,
      currency: "NGN",
      status: "pending",
      reference: `PYW-${Date.now()}`,
      expiresAt: expirationTime,
      type,
    });

    const paymentData = {
      amount: newPayment.amount,
      redirect_url: "https://korapay.com",
      currency: "NGN",
      reference: newPayment.reference,
      narration: "Payment for product Y",
      channels: ["card", "bank_transfer", "pay_with_bank"],
      default_channel: "pay_with_bank",
      customer: { email: email },
      notification_url: "https://paywave-api-psi.vercel.app/api/v1/webhook",
      merchant_bears_cost: false,
      metadata: {
        key0: "test0",
      },
    };

    if (!paymentData) {
      return res.status(400).json({ message: "Invalid payment data" });
    }

    const korapayResponse = await axios.post(
      `${KORAPAY_API_BASE_URL}/merchant/api/v1/charges/initialize`,
      paymentData,
      {
        headers: {
          Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { data } = korapayResponse.data || {};
    if (!data || !data.checkout_url) {
      return res.status(500).json({
        message: "Invalid Korapay API response",
        API_Error:
          korapayResponse.data || "No additional error details from API",
      });
    }

    const { checkout_url } = data;

    newPayment.checkout_url = checkout_url;

    // const scanUrl = `${req.protocol}://${req.get('host')}/api/v1/scan/${newPayment.type}/${newPayment.reference}`;
    // const qrCodeDataURL = await QRCode.toDataURL(scanUrl);

    const scanUrl = `${req.protocol}://${req.get("host")}/scan?type=${
      newPayment.type
    }&reference=${newPayment.reference}`;
    const qrCodeDataURL = await QRCode.toDataURL(scanUrl);

    newPayment.qrCode = qrCodeDataURL;
    await newPayment.save();

    return res.status(201).json({
      message: "QR Payment successfully generated!",
      qrCode: qrCodeDataURL,
      paymentUrl: checkout_url,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
      API_Error: error.response?.data || "No additional error details from API",
    });
  }
};

exports.scanDynamicQRCode = async (req, res) => {
  try {
    const { reference } = req.params;

    const payment = await paymentModel.findOne({ reference });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    const currentTime = new Date();
    if (payment.expiresAt && payment.expiresAt < currentTime) {
      return res.status(400).json({
        message: "QR Code has expired",
        expired: true,
      });
    }

    if (payment.status === "success") {
      return res.status(200).json({
        message: "Payment has already been completed",
        completed: true,
      });
    }

    // return res.redirect(payment.checkout_url);

    // Return the checkout URL to the frontend
    return res.json({
      checkoutUrl: payment.checkout_url,
      qrCode: payment.qrCode,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.scanStaticCustomQRCode = async (req, res) => {
  try {
    const { reference } = req.params;
    const { amount } = req.body || {};

    const payment = await paymentModel.findOne({ reference });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (payment.status === "success") {
      return res.status(200).json({
        message: "Payment has already been completed",
        completed: true,
      });
    }

    if (amount && !isNaN(amount) && amount > 0) {
      // Generate new checkout URL with the custom amount
      const paymentData = {
        amount: amount,
        redirect_url: "https://korapay.com",
        currency: "NGN",
        reference: `PYW-${Date.now()}`,
        narration: "Payment for product Y",
        channels: ["card", "bank_transfer", "pay_with_bank"],
        default_channel: "pay_with_bank",
        customer: { email: payment.email },
        notification_url: "https://paywave-api-psi.vercel.app/api/v1/webhook",
        merchant_bears_cost: false,
        metadata: {
          key0: "test0",
        },
      };

      const korapayResponse = await axios
        .post(
          `${KORAPAY_API_BASE_URL}/merchant/api/v1/charges/initialize`,
          paymentData,
          {
            headers: {
              Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
              "Content-Type": "application/json",
            },
          }
        )
        .catch((error) => {
          console.error(error.response?.data || error.message);
        });

      const { data } = korapayResponse.data || {};
      if (!data || !data.checkout_url) {
        return res.status(500).json({
          message: "Invalid Korapay API response",
          API_Error:
            korapayResponse.data || "No additional error details from API",
        });
      }

      const { checkout_url } = data;

      // Update the payment document with the new checkout URL
      payment.checkout_url = checkout_url;
      await payment.save();

      return res.json({ checkoutUrl: checkout_url, qrCode: payment.qrCode });
    } else {
      return res.status(400).json({ message: "Invalid amount provided" });
    }
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.scanStaticDefinedQRCode = async (req, res) => {
  try {
    const { reference } = req.params;

    const payment = await paymentModel.findOne({ reference });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (payment.status === "success") {
      return res.status(200).json({
        message: "Payment has already been completed",
        completed: true,
      });
    }

    // Generate new checkout URL
    const paymentData = {
      amount: payment.amount,
      redirect_url: "https://korapay.com",
      currency: "NGN",
      reference: `PYW-${Date.now()}`,
      narration: "Payment for product Y",
      channels: ["card", "bank_transfer", "pay_with_bank"],
      default_channel: "pay_with_bank",
      customer: { email: payment.email },
      notification_url: "https://paywave-api-psi.vercel.app/api/v1/webhook",
      merchant_bears_cost: false,
      metadata: {
        key0: "test0",
      },
    };

    const korapayResponse = await axios.post(
      `${KORAPAY_API_BASE_URL}/merchant/api/v1/charges/initialize`,
      paymentData,
      {
        headers: {
          Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    ).catch((error) => {
      console.error(error.response?.data || error.message);
    });

    const { data } = korapayResponse.data || {};
    if (!data || !data.checkout_url) {
      return res.status(500).json({
        message: "Invalid Korapay API response",
        API_Error:
          korapayResponse.data || "No additional error details from API",
      });
    }

    const { checkout_url } = data;

    // Update the payment document with the new checkout URL
    payment.checkout_url = checkout_url;
    await payment.save();

    return res.json({ checkoutUrl: checkout_url, qrCode: payment.qrCode });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// New endpoint for payment confirmation
exports.confirmPayment = async (req, res) => {
  const { reference } = req.body;

  if (!reference) {
    return res.status(400).send({ error: "Missing reference" });
  }

  try {
    // Verify the KoraPay payment made to Virtual Bank Account
    const response = axios.get(
      `${KORAPAY_API_BASE_URL}/merchant/api/v1/charges/${reference}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const paymentData = response.data;

    if (paymentData.data.status !== "success") {
      return res.status(400).send({ error: "Payment verification failed" });
    }

    // Update the payment status for successful payments
    const paymentRecord = await paymentModel.findOne({
      reference: paymentData.data.reference,
    });
    if (paymentRecord) {
      paymentRecord.status = "success";
      await paymentRecord.save();
    }

    // Payment was successful, return a success response
    return res.status(200).json({
      message: "Payment successful! Verification complete",
      paymentData: paymentData,
    });
  } catch (error) {
    console.error("Error confirming payment:", error.message);
    return res.status(500).send({ error: error.message });
  }
};

// Function to get merchant payments history through their virtual bank accounts
exports.getMerchantPaymentHistory = async (req, res) => {
  try {
    const { accountNumber } = req.params;

    if (!accountNumber) {
      return res.status(400).send({ error: "Missing account" });
    }

    // Korapay Virtual bank account transaction history
    const response = axios.get(
      `${KORAPAY_API_BASE_URL}/merchant/api/v1/virtual-bank-account/transactions?account_number=${accountNumber}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const paymentData = response.data;

    if (paymentData.data.status !== "success") {
      return res.status(400).send({ error: "Payment verification failed" });
    }
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
