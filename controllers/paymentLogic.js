const paymentModel = require("../models/paymentModel");
const merchantModel = require("../models/merchantModel");
const bankCodeModel = require("../models/banksCodeModel");
const crypto = require("crypto");
const axios = require("axios");
require("dotenv").config();

const KORAPAY_API_BASE_URL = process.env.KORAPAY_API_BASE_URL;
const KORAPAY_SECRET_KEY = process.env.KORAPAY_SECRET_KEY;
const KORAPAY_ENCRYPTION_KEY = process.env.KORAPAY_ENCRYPTION_KEY;

function encryptAES256(encryptionKey, paymentData) {
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = cipher.update(paymentData);

  const ivToHex = iv.toString("hex");
  const encryptedToHex = Buffer.concat([encrypted, cipher.final()]).toString(
    "hex"
  );

  return `${ivToHex}:${encryptedToHex}:${cipher.getAuthTag().toString("hex")}`;
}

// Function for pay with card without checkout
exports.cardPay = async (req, res) => {
  try {
    const { cardDetails, amount, email } = req.body;
    //cardDetails are  {
    //   	"name": "Test Cards", // optional
    //       "number": "5130000052131820",
    //       "cvv": "419",
    //       "expiry_month": "12",
    //       "expiry_year": "32",
    //       "pin": "0000" // optional
    //   }

    // Create the payload as per the provided structure
    const paymentPayload = {
      reference: `PYW_card_${Date.now()}`,
      card: {
        name: cardDetails.name || "",
        number: cardDetails.number,
        cvv: cardDetails.cvv,
        expiry_month: cardDetails.expiry_month,
        expiry_year: cardDetails.expiry_year,
        pin: cardDetails.pin || "",
      },
      amount: amount,
      currency: "NGN",
      redirect_url: "https://korapay.com",
      customer: {
        email: email,
      },
      metadata: {
        test01: "123456",
      },
    };

    // Encrypt the payment data
    const encryptedData = encryptAES256(
      KORAPAY_ENCRYPTION_KEY,
      JSON.stringify(paymentPayload)
    );

    // Prepare the payload
    const payload = {
      charge_data: encryptedData,
    };

    // Send the request to Korapay
    const response = await axios.post(
      `${KORAPAY_API_BASE_URL}/merchant/api/v1/charges/card`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
        },
      }
    );

    // Handle the response from Korapay
    if (response.data.data.status === "success") {
      return res
        .status(200)
        .json({ message: "Payment successful", data: response.data });
    } else {
      return res.status(400).json({
        message: "Payment requires additional actions",
        data: response.data,
      });
    }
  } catch (error) {
    return res.status(500).json({
      message: "Payment failed: " + error.message,
      API_Error: error.response?.data || "No additional error details from API",
    });
  }
};

// Function to authorize card payment request
exports.cardAuthorize = async (req, res) => {
  try {
    const {
      transaction_reference,
      authorization: { otp = null, pin = null } = {},
    } = req.body;

    if (!transaction_reference || (!otp && !pin)) {
      return res.status(400).json({
        message:
          "Please provide the transaction reference and either an OTP or PIN.",
      });
    }

    // Create `authorization` object with either `pin` or `otp` as the key
    const authorization = pin ? { pin } : { otp };

    const requestBody = {
      transaction_reference,
      authorization,
    };

    const response = await axios.post(
      `${KORAPAY_API_BASE_URL}/merchant/api/v1/charges/card/authorize`,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.status === "success") {
      // Update payment record in the database
      const payment = await paymentModel.findOne({
        reference: transaction_reference,
      });
      payment.status = "success";
      await payment.save();
      return res.status(200).json(response.data);
    } else {
      return res
        .status(400)
        .json({ message: "Authorization failed", data: response.data });
    }
  } catch (error) {
    return res.status(500).json({
      message: "Error authorizing payment: " + error.message,
      API_Error: error.response?.data || "No additional error details from API",
    });
  }
};

// Function to resend OTP for card payment request
exports.cardResendOTPPay = async (req, res) => {
  const { transaction_reference } = req.body;

  if (!transaction_reference) {
    return res
      .status(400)
      .json({ message: "Please provide the transaction reference." });
  }

  try {
    const response = await axios.post(
      `${KORAPAY_API_BASE_URL}/merchant/api/v1/charges/card/resend-otp`,
      { transaction_reference },
      {
        headers: {
          Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.status === "success") {
      return res
        .status(200)
        .json({ message: "OTP resent successfully", data: response.data });
    } else {
      return res
        .status(400)
        .json({ message: "Failed to resend OTP", data: response.data });
    }
  } catch (error) {
    return res.status(500).json({
      message: "Error resending OTP: " + error.message,
      API_Error: error.response?.data || "No additional error details from API",
    });
  }
};

// Function for pay with bank transfer without checkout
// exports.bankTransferPay = async (req, res) => {
//   try {
//     const { amount, bankCode, accountNumber, email } = req.body;

//     const response = await axios.post(
//       `${KORAPAY_API_BASE_URL}/merchant/api/v1/charges/bank-transfer`,
//       {
//         amount,
//         // bank_code: bankCode,
//         account_name: "Demo account",
//         currency: "NGN",
//         reference: `PYW_bank_${Date.now()}`,
//         customer: {
//         email: email
//     }
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
//         },
//       }
//     );

//     return res.status(200).json(response.data);
//   } catch (error) {
//     return res.status(500).json({
//       message: "Bank transfer failed: " + error.message,
//       API_Error: error.response?.data || "No additional error details from API",
//     });
//   }
// };

// Helper function to verify bank account
const verifyBankAccount = async (bankCode, accountNumber) => {
  try {
    const requestBody = {
      bank: bankCode,
      account: accountNumber,
      currency: "NGN",
    };

    const response = await axios.post(
      `${KORAPAY_API_BASE_URL}/merchant/api/v1/misc/banks/resolve`,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.data.bank_code === bankCode) {
      return response.data.data;
    } else {
      throw new Error("Bank account verification failed");
    }
  } catch (error) {
    throw new Error(
      "Unable to verify bank account: " +
        (error.response?.data?.message || error.message)
    );
  }
};

// Function for pay with bank transfer without checkout
exports.bankTransferPay = async (req, res) => {
  try {
    const { amount, bankCode, accountNumber, email } = req.body;

    if (bankCode) {
      // Validate that bankCode exists in your local database
      const banksCode = await bankCodeModel.findOne({ code: bankCode });
      if (!banksCode || !banksCode.code) {
        return res.status(400).json({ message: "Invalid bank code" });
      }

      // Verify the bank account
      const verifiedAccount = await verifyBankAccount(bankCode, accountNumber);
      if (!verifiedAccount) {
        return res
          .status(400)
          .json({ message: "Invalid bank account details" });
      }
    }
    // Create the payload for the bank transfer
    const transferPayload = {
      amount,
      bank_code: banksCode.code || "",
      account_number: accountNumber || "",
      account_name: "Demo account" || "",
      currency: "NGN",
      reference: `PYW_bank_${Date.now()}`,
      merchant_bears_cost: false,
      customer: {
        email: email,
        name: verifiedAccount.account_name || "",
      },
      metadata: {
        purpose: "Payment via bank transfer",
      },
    };

    // Send the bank transfer request to Korapay
    const response = await axios.post(
      `${KORAPAY_API_BASE_URL}/merchant/api/v1/charges/bank-transfer`,
      transferPayload,
      {
        headers: {
          Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
        },
      }
    );

    // Handle success response
    if (response.data.status === "success") {
      return res.status(200).json({
        message: "Bank transfer initiated successfully",
        data: response.data,
      });
    } else {
      return res.status(400).json({
        message: "Bank transfer initiation failed",
        data: response.data,
      });
    }
  } catch (error) {
    // Handle any errors that occur
    return res.status(500).json({
      message: "Bank transfer failed: " + error.message,
      API_Error: error.response?.data || "No additional error details from API",
    });
  }
};
