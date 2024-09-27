const withdrawModel = require("../models/withdrawModel");
const merchantModel = require("../models/merchantModel");
const bankCodeModel = require("../models/banksCodeModel");
const crypto = require("crypto");
const axios = require("axios");
require("dotenv").config();

const KORAPAY_API_BASE_URL = process.env.KORAPAY_API_BASE_URL;
const KORAPAY_SECRET_KEY = process.env.KORAPAY_SECRET_KEY;
const KORAPAY_PUBLIC_KEY = process.env.KORAPAY_PUBLIC_KEY;
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

// Helper function to list banks
exports.listBanks = async () => {
  try {
    const response = await axios.get(
      `${KORAPAY_API_BASE_URL}/merchant/api/v1/misc/banks?countryCode=NG`,
      {
        headers: {
          Authorization: `Bearer ${KORAPAY_PUBLIC_KEY}`,
        },
      }
    );
    console.log(response.data.data);
    const banks = response.data.data;

    // Step 2: Use map to create an array of save promises
    const savePromises = banks.map((bank) => {
      const newBankCode = new bankCodeModel({
        name: bank.name,
        slug: bank.slug,
        code: bank.code,
        country: bank.country,
        nibss_bank_code: bank.nibss_bank_code,
      });

      // Step 3: Return the promise of the save operation
      return newBankCode.save();
    });

    // Step 4: Use Promise.all to wait for all save operations to complete
    await Promise.all(savePromises);
  } catch (error) {
    console.error("Error fetching banks:", error.message);
    throw new Error("Unable to fetch bank list");
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
    throw new Error("Unable to verify bank account", error.message);
  }
};

// Function to process withdrawal
exports.withdrawFunds = async (req, res) => {
  try {
    const { userId } = req.user;
    const { amount, beneficiaryBankCode, beneficiaryAccountNumber, email } = req.body;

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
    const payoutReference = `PYW_wdwl_${Date.now()}`;

    // Prepare the payout request body
    const requestBody = {
      reference: payoutReference,
      destination: {
        type: "bank_account",
        amount: amount,
        currency: "NGN",
        narration: "Withdrawal for merchant",
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

    // Handle response
    if (
      response.data.data.status === "success" ||
      response.data.data.status === "processing"
    ) {
      // Record the successful withdrawal in the withdrawal model
      const newWithdrawal = new withdrawModel({
        reference: payoutReference,
        merchant: userId,
        amount,
        status: response.data.data.status || "",
        type: "withdrawal",
        email: email,
        currency: requestBody.destination.currency || "NGN",
      });
      await newWithdrawal.save();

      // Respond to the client
      return res.status(200).json({
        message: "Withdrawal processed successfully",
        data: response.data,
      });
    } else {
      return res.status(400).json({
        message: "Withdrawal failed",
        data: response.data,
      });
    }
  } catch (error) {
    console.error("Error processing withdrawal", error);
    return res.status(500).json({
      message: "Error processing withdrawal: " + error.message,
      API_Error: error.response?.data || "No additional error details from API",
    });
  }
};

// Function to get all banks and their bank code
exports.getAllBankCode = async (req, res) => {
  try {
    // Get the page number and limit from query parameters, with default values
    const page = parseInt(req.query.page) || 1; 
    const limit = parseInt(req.query.limit) || 10; 
    const skip = (page - 1) * limit; 

    // Fetch bank codes with pagination
    const bankCode = await bankCodeModel.find().skip(skip).limit(limit);

    // Get the total number of bank codes for pagination info
    const totalBankCodes = await bankCodeModel.countDocuments();

    if (!bankCode || bankCode.length === 0) {
      return res.status(400).json({ message: "Banks not found!" });
    }

    return res.status(200).json({
      message: "List of banks in Nigeria and their bank code",
      data: bankCode,
      pagination: {
        total: totalBankCodes,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalBankCodes / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error: " + error.message,
    });
  }
};
