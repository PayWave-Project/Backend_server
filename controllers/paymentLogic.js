const merchantModel = require("../models/merchantModel");
const transactionModel = require("../models/transactionModel");
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
    //   	  "name": "Test Cards", // optional
    //       "number": "5130000052131820",
    //       "cvv": "419",
    //       "expiry_month": "12",
    //       "expiry_year": "32",
    //       "pin": "0000" // optional
    //   }

    if (!email) return res.status(400).json({ message: "Enter a valid email address!" });
    if (!cardDetails) return res.status(400).json({ message: "Invalid card details format!" });

    // Create the payload as per the provided structure

    const { userId } = req.user;

    const merchant = await merchantModel.findById(userId);
    if (!merchant)
      return res.status(400).json({ message: "Merchant not found!" });

    if (isNaN(amount)) {
      return res.status(400).json({ message: "Amount must be a valid number!" });
    }

    if (amount < 100) {
      return res.status(400).json({ message: "Amount must be 100 or above!" });
    }

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
      redirect_url: "https://app-paywave.vercel.app",
      merchant_bears_cost: false,
      customer: {
        email: email,
      },
      metadata: {
        merchantId: merchant.merchantId,
        merchantName: `${merchant.firstName} ${merchant.lastName}`
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

    const transaction = {
      merchant: merchant._id,
      merchantId: merchant.merchantId,
      currency: response.data.data.currency,
      email: email,
      amount: response.data.data.amount,
      status: response.data.data.status,
      reference: response.data.data.payment_reference,
      type: "Card",
    };

    // Handle the response from Korapay
    if (response.data.data.status === "success") {
      await saveTransaction(transaction);

      return res.status(200).json({ message: "Payment successful", data: response.data });
    } else {
      await saveTransaction(transaction);

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

    const { userId } = req.user;

    const merchant = await merchantModel.findById(userId);
    if (!merchant)
      return res.status(400).json({ message: "Merchant not found!" });

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
      const payment = await transactionModel.findOne({
        reference: merchant.reference,
      });
      payment.status = "success";
      await payment.save();
      return res.status(200).json(response.data);
    } else {
      // Update payment record in the database
      const payment = await transactionModel.findOne({
        reference: merchant.reference,
      });
      payment.status = "failed";
      await payment.save();
      return res.status(400).json({ message: "Authorization failed", data: response.data });
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
    return res.status(400).json({ message: "Please provide the transaction reference." });
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
      return res.status(200).json({ message: "OTP resent successfully", data: response.data });
    } else {
      return res.status(400).json({ message: "Failed to resend OTP", data: response.data });
    }
  } catch (error) {
    return res.status(500).json({
      message: "Error resending OTP: " + error.message,
      API_Error: error.response?.data || "No additional error details from API",
    });
  }
};

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

    if (!email) return res.status(400).json({ message: "Enter a valid email address!" });

    const { userId } = req.user;

    const merchant = await merchantModel.findById(userId);
    if (!merchant) return res.status(400).json({ message: "Merchant not found!" });

    if (isNaN(amount)) {
      return res.status(400).json({ message: "Amount must be a valid number!" });
    }

    if (amount < 100) {
      return res.status(400).json({ message: "Amount must be 100 or above!" });
    }

    let transferPayload = {
      amount,
      account_name: "Demo account" || "",
      currency: "NGN",
      reference: `PYW_bank_${Date.now()}`,
      merchant_bears_cost: false,
      customer: {
        email: email,
      },
      metadata: {
        merchantId: merchant.merchantId,
        merchantName: `${merchant.firstName} ${merchant.lastName}`
      },
    };

    // Check if bankCode is provided
    if (bankCode) {
      // Validate that bankCode exists in your local database
      const banksCode = await bankCodeModel.findOne({ code: bankCode });
      if (!banksCode || !banksCode.code) {
        return res.status(400).json({ message: "Invalid bank code" });
      }

      // Check if accountNumber is provided
      if (accountNumber) {
        // Verify the bank account if accountNumber is also provided
        const verifiedAccount = await verifyBankAccount(
          bankCode,
          accountNumber
        );
        if (!verifiedAccount) {
          return res.status(400).json({ message: "Invalid bank account details" });
        }

        // Add bank code and account number to transfer payload
        transferPayload.bank_code = banksCode.code;
        transferPayload.account_number = accountNumber;
        transferPayload.account_name =
          verifiedAccount.account_name || "Demo account"; // Use the verified account name
      }
    }

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

    const transaction = {
      merchant: merchant._id,
      merchantId: merchant.merchantId,
      currency: response.data.data.currency,
      email: response.data.data.customer.email,
      amount: response.data.data.amount,
      status: response.data.data.status,
      reference: response.data.data.payment_reference,
      type: "Transfer",
    };

    // Handle success response
    if (response.data.status === "success") {
      await saveTransaction(transaction);

      return res.status(200).json({
        message: "Bank transfer initiated successfully",
        data: response.data,
      });
    } else {
      await saveTransaction(transaction);

      return res.status(400).json({
        message: "Bank transfer initiation processing",
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


exports.sendMoney = async (req, res) => {
  try {
    const { userId } = req.user;
    const { amount, beneficiaryBankCode, beneficiaryAccountNumber, email, description } = req.body;

    if (!amount || !email || !beneficiaryBankCode ||!beneficiaryAccountNumber) {
      return res.status(400).json({ message: "Enter amount, email address, account number and bank code!"});
    }

    // Fetch merchant details
    const merchant = await merchantModel.findById(userId);
    if (!merchant) {
      return res.status(404).json({ message: "Merchant not found" });
    }

    if (isNaN(amount)) {
      return res.status(400).json({ message: "Amount must be a valid number!" });
    }

    if (amount < 1000) {
      return res.status(400).json({ message: "Amount must be 1000 or above for Payout!" });
    }

    if (merchant.balance < amount) {
      return res.status(400).json({ message: "Insufficient account balance." });
    }

    const bankCode = await bankCodeModel.findOne({ code: beneficiaryBankCode });

    if (!bankCode && !bankCode.code) {
      return res.status(400).json({ message: "Invalid bank code" });
    }

    // Verify the bank account
    const verifiedAccount = await verifyBankAccount(
      beneficiaryBankCode,
      beneficiaryAccountNumber
    );
    if (!verifiedAccount) {
      return res.status(400).json({ message: "Invalid bank account details" });
    }

    // Generate a unique reference for this transaction
    const payoutReference = `PYW_trn_${Date.now()}`;

    // Prepare the request body
    const requestBody = {
      reference: payoutReference,
      destination: {
        type: "bank_account",
        amount: amount,
        currency: "NGN",
        narration: description,
        bank_account: {
          bank: beneficiaryBankCode,
          account: beneficiaryAccountNumber,
        },
        customer: {
          email: email,
        },
      },
      metadata: {
        merchantId: merchant.merchantId,
        merchantName: `${merchant.firstName} ${merchant.lastName}`
      },
    };

    // Encrypt the payment data
    const encryptedData = encryptAES256(
      KORAPAY_ENCRYPTION_KEY,
      JSON.stringify(requestBody)
    );

    // Call the KoraPay payout API
    const response = await axios.post(
      `${KORAPAY_API_BASE_URL}/merchant/api/v1/transactions/disburse`,
      { encrypted_data: encryptedData },
      {
        headers: {
          Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const transaction = {
      merchant: merchant._id,
      merchantId: merchant.merchantId,
      currency: response.data.data.currency,
      email: response.data.data.customer.email,
      amount: response.data.data.amount,
      status: response.data.data.status,
      reference: response.data.data.reference,
      type: "Transfer",
    };

    // Handle response
    if (
      response.data.data.status === "success" ||
      response.data.data.status === "processing"
    ) {
      await saveTransaction(transaction);

      // Respond to the client
      return res.status(200).json({
        message: "Withdrawal processed successfully",
        data: response.data,
      });
    } else {
      await saveTransaction(transaction);

      return res.status(400).json({
        message: "Withdrawal failed",
        data: response.data,
      });
    }

  } catch (error) {
    return res.status(500).json({
      message: "Error sending money: " + error.message,
      API_Error: error.response?.data || "No additional error details from API",
    });
  }
};


//Helper function to save transaction details 
const saveTransaction = async (transactionData) => {
  try {
    // Create a new transaction instance
    const transaction = new transactionModel({
      merchant: transactionData.merchant,
      email: transactionData.email,
      merchantId: transactionData.merchantId,
      amount: transactionData.amount,
      currency: transactionData.currency,
      status: transactionData.status,
      reference: transactionData.reference,
      type: transactionData.type,
    });

    // Save the transaction to the database
    const savedTransaction = await transaction.save();
    return savedTransaction;
  } catch (error) {
    console.error("Error saving transaction:", error.message);
    throw new Error("Failed to save transaction");
  }
};