const merchantModel = require("../models/merchantModel");
const axios = require("axios");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/email");
const { generateDynamicEmail } = require("../utils/emailText");
const verifiedHTML = require("../utils/verified");
const resetSuccessfulHTML = require("../utils/resetSuccessful");
const { resetFunc } = require("../utils/forgot");
const {
  validateMerchant,
  validateResetPassword,
} = require("../middleware/validator");
const { hashPassword, hashPIN, hashBVN, hashCAC } = require("../utils/hashUtilis");
const {
  verifyCACWithKoraPay,
  verifyBVNWithKoraPay,
} = require("../apis/koraApi");
const { generateLoginNotificationEmail } = require("../utils/sendLogin Email");
const {
  generateUnlockNotificationEmail,
} = require("../utils/UnlockNotificationEmail ");
const { resetNotification } = require("../utils/resetNotification");
const moment = require("moment");
const cloudinary = require("../middleware/cloudinary");
const path = require("path");
const fs = require("fs");

const KORAPAY_API_BASE_URL = process.env.KORAPAY_API_BASE_URL;
const KORAPAY_SECRET_KEY = process.env.KORAPAY_SECRET_KEY;

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const toTitleCase = (str) => {
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

async function createVirtualAccount(merchantDetail, merchantID,) {
  try {

    const response = await axios.post(
      `${KORAPAY_API_BASE_URL}/merchant/api/v1/virtual-bank-account`,
      {
        account_name: merchantDetail.businessName,
        account_reference: merchantID,
        permanent: true,
        bank_code: '000',
        customer: {
            name: merchantDetail.businessName,
            email: merchantDetail.email,
        },
        kyc: {
            bvn: merchantDetail.bvn,
        }
      },
      {
        headers: {
          Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data.data;
  } catch (error) {
    console.error("Error creating virtual account:", error);
    console.error("API_Error: ", error.response.data);
    throw new Error("Failed to create virtual account");
  }
}

// Function to Register a new merchant on the platform
exports.registerMerchant = async (req, res) => {
  try {
    const validationResult = validateMerchant(req.body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return res.status(400).json({
        message: "Validation errors occurred",
        errors,
      });
    }

    const merchantDetail = {
      firstName: req.body.firstName.toLowerCase().trim(),
      lastName: req.body.lastName.toLowerCase().trim(),
      email: req.body.email.toLowerCase().trim(),
      businessName: req.body.businessName.toLowerCase().trim(),
      phoneNumber: req.body.phoneNumber.trim(),
      password: req.body.password,
    };

    if (!merchantDetail) {
      return res.status(400).json({ message: "Please fill all field below!" });
    }

    const emailExist = await merchantModel.findOne({
      email: merchantDetail.email.toLowerCase().trim(),
    });
    if (emailExist)
      return res.status(200).json({ message: "Email already exists!" });

    // Hash password and sensitive information
    const hashedPassword = await hashPassword(merchantDetail.password);

    const merchantID = `payWave-${Date.now()}`;

    // Generate OTP
    const otp = generateOTP();
    // OTP expires in 15 minutes
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

    const merchant = new merchantModel({
      firstName: merchantDetail.firstName.trim(),
      lastName: merchantDetail.lastName.trim(),
      email: merchantDetail.email.trim(),
      businessName: merchantDetail.businessName.trim(),
      phoneNumber: merchantDetail.phoneNumber.trim(),
      merchantId: merchantID,
      password: hashedPassword,
      otp: otp,
      otpExpiry: otpExpiry,
      isVerified: false,
    });

    const token = jwt.sign(
      {
        userId: merchant._id,
      },
      process.env.SECRET,
      { expiresIn: "900s" }
    );
    merchant.token = token;
    const subject = "Email Verification";

    // const otp = `${req.protocol}://${req.get("host")}/api/v1/verify-merchant/${merchant._id}/${merchant.token}`;
    const html = generateDynamicEmail(merchant.firstName, otp);
    try {
      await sendEmail({
        email: merchant.email,
        html,
        subject,
      });
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      return res.status(500).json({
        message:
          "Account created, but failed to send verification email. Please contact support.",
        error: emailError.message,
      });
    }
    await merchant.save();
    return res.status(201).json({
      message:
        "Successfully created an account on PayWave!, Please log in to your mail and verify your account",
      data: {
        ...merchant.toObject(),
        password: undefined,
        otp: undefined,
        otpAttempts: undefined,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error: ",
      error: error.message,
      API_Error: error.response?.data || "No additional error details from API",
    });
  }
};

//Function to verify a new merchant via a otp
exports.verify = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if ( !email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required!",
      });
    }

    const merchant = await merchantModel.findOne({ email: email.toLowerCase()});
    if (!merchant) {
      return res.status(404).json({
        message: "Merchant not found",
      });
    }

    console.log(`Stored OTP: ${merchant.otp}, type: ${typeof merchant.otp}`);
    console.log(
      `OTP Expiry: ${merchant.otpExpiry}, Current time: ${new Date()}`
    );

    if (merchant.isVerified) {
      return res.status(400).json({ message: "Merchant is already verified." });
    }

    // Check if the merchant is blocked
    if (merchant.blockedUntil) {
      if (moment().isBefore(merchant.blockedUntil)) {
        const remainingTime = moment.duration(
          moment(merchant.blockedUntil).diff(moment())
        );
        return res.status(403).json({
          message: `Account is blocked. Please try again in ${remainingTime
            .asMinutes()
            .toFixed(0)} minutes.`,
        });
      } else {
        // The block period has passed, reset the block and generate new OTP
        const newOTP = generateOTP();
        const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

        await merchantModel.findByIdAndUpdate(id, {
          blockedUntil: null,
          otpAttempts: 0,
          otp: newOTP,
          otpExpiry: otpExpiry,
        });

        // Send unlock email with new OTP
        const subject = "Your account has been unlocked";
        const html = generateUnlockNotificationEmail(
          merchant.firstName,
          newOTP
        );
        await sendEmail({
          email: merchant.email,
          html,
          subject,
        });

        return res
          .status(200)
          .json({
            message:
              "Your account has been unlocked. A new OTP has been sent to your email.",
          });
      }
    }

    // Initialize attempts if not present
    if (!merchant.otpAttempts) {
      merchant.otpAttempts = 0;
    }

    // Check if the OTP has expired
    if (!merchant.otpExpiry || new Date() > merchant.otpExpiry) {
      // Reset OTP fields
      await merchantModel.findByIdAndUpdate(id, {
        otp: null,
        otpExpiry: null,
        otpAttempts: 0,
      });
      return res.status(400).json({
        message: "OTP has expired. Please request a new OTP.",
        expired: true,
      });
    }

    // Check if the OTP is valid
    if (merchant.otp !== otp) {
      console.log(`OTP mismatch. Stored: ${merchant.otp}, Received: ${otp}`);
      merchant.otpAttempts += 1;

      //   await merchantModel.findByIdAndUpdate(
      //     id,
      //     { otp: null, otpExpiry: null, otpAttempts: 0 },
      //     { new: true }
      //   );
      //   return res.status(400).json({ message: "Maximum attempts reached. Please request a new OTP." });
      // }

      if (merchant.otpAttempts >= 3) {
        // Block the account for 1 hour
        const blockedUntil = moment().add(1, "hour").toDate();
        await merchantModel.findByIdAndUpdate(id, {
          otp: null,
          otpExpiry: null,
          otpAttempts: 0,
          blockedUntil: blockedUntil,
        });
        return res
          .status(403)
          .json({
            message:
              "Maximum attempts reached. Your account is blocked for 1 hour.",
          });
      }

      await merchant.save();
      return res.status(400).json({
        message: "Invalid OTP",
        attemptsRemaining: 3 - merchant.otpAttempts,
      });
    }

    console.log("OTP validated successfully");

    // OTP is valid, verify the merchant and reset OTP-related fields
    const updatedMerchant = await merchantModel.findByIdAndUpdate(
      merchant._id,
      {
        isVerified: true,
        otp: null,
        otpExpiry: null,
        otpAttempts: 0,
        status: "verified",
      },
      { new: true }
    );

    if (!updatedMerchant) {
      return res
        .status(500)
        .json({ message: "Failed to update merchant verification status" });
    }

    return res.status(200).json({
      message: "Merchant successfully verified",
    });
  } catch (error) {
    console.error("Error in verify function:", error);
    return res.status(500).json({
      message: "Internal Server Error: ",
      error: error.message,
    });
  }
};

exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if ( !email ) {
      return res.status(400).json({
        message: "Email and OTP are required!",
      });
    }

    const merchant = await merchantModel.findOne({ email: email.toLowerCase()});
    if (!merchant) {
      return res.status(404).json({
        message: "Merchant not found",
      });
    }

    if (merchant.isVerified) {
      return res.status(400).json({ message: "Merchant is already verified." });
    }

    // Generate new OTP and set 15 minutes from now

    const newOTP = generateOTP();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);
    // Update merchant with new OTP
    await merchantModel.findByIdAndUpdate(id, {
      otp: newOTP,
      otpExpiry: otpExpiry,
      otpAttempts: 0,
    });

    // Send email with new OTP
    const subject = "New OTP for Email Verification";
    const html = generateDynamicEmail(merchant.firstName, newOTP);

    await sendEmail({
      email: merchant.email,
      html,
      subject,
    });

    return res.status(200).json({
      message: "New OTP has been sent to your email.",
    });
  } catch (error) {
    console.error("Error in resendOTP function:", error);
    return res.status(500).json({
      message: "Internal Server Error: ",
      error: error.message,
    });
  }
};

//Function to login a verified Merchant account
exports.logIn = async (req, res) => {
  try {
    const merchantData = {
      email: req.body.email,
      password: req.body.password,
    };

    if (!merchantData)
      return res
        .status(400)
        .json({ message: "Please fill all the field below!" });

    const checkEmail = await merchantModel.findOne({
      email: merchantData.email.toLowerCase(),
    });
    if (!checkEmail) {
      return res.status(404).json({
        message: "Merchant not registered",
      });
    }
    const checkPassword = bcrypt.compareSync(
      merchantData.password,
      checkEmail.password
    );
    if (!checkPassword) {
      return res.status(404).json({
        message: "Password is incorrect",
      });
    }
    const token = jwt.sign(
      {
        userId: checkEmail._id,
      },
      process.env.SECRET,
      { expiresIn: "20h" }
    );

    checkEmail.token = token;
    await checkEmail.save();

    const loginTime = new Date().toLocaleString();
    console.log(
      `Successful login: ${checkEmail.email} (${checkEmail.businessName}) at ${loginTime}`
    );

    // Send login notification email
    await sendEmail({
      email: checkEmail.email,
      html: generateLoginNotificationEmail(checkEmail.firstName, loginTime),
      subject: "Login Notification",
    });

    // If login is successful
    const { password: _, otp, otpExpiry, otpAttempts, ...merchantWithoutPassword } = checkEmail.toObject();

    if (checkEmail.status === "verified") {
      return res.status(200).json({
        message: "Login Successfully! Welcome " + checkEmail.businessName,
        token: token,
        merchant: merchantWithoutPassword,
      });
    } else {
      return res.status(400).json({
        message:
          "Sorry Merchant not verified yet. Check your mail to verify your account!",
      });
    }
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error: ",
      error: error.message,
    });
  }
};

//Function for the Merchant, incase password is forgotten
exports.forgotPassword = async (req, res) => {
  try {
    const email = req.body.email;
    if (!email) {
      return res.status(400).json({
        message: "Please enter your email address!",
      });
    }
    const merchant = await merchantModel.findOne({
      email: email.toLowerCase(),
    });
    if (!merchant) {
      return res.status(404).json({
        message: "Email does not exist",
      });
    } else {
      // Generate OTP
      const otp = generateOTP();
      merchant.otp = otp;
      // OTP expires in 15 minutes
      const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);
      merchant.otpExpiry = otpExpiry;
      merchant.otpAttempts = 0; // Initialize the attempt count

      const subject = "Kindly reset your password";

      const name = `${merchant.firstName} ${merchant.lastName}`;
      const html = resetNotification(name, otp);

      await sendEmail({
        email: merchant.email,
        html,
        subject,
      });

      await merchant.save();

      return res.status(200).json({
        message: "Kindly check your email for an OTP to reset your password"
      });
    }
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error: ",
      error: error.message,
    });
  }
};

// Function to verify the OTP for Merchants to reset password
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if ( !email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required!",
      });
    }

    const merchant = await merchantModel.findOne({ email: email.toLowerCase()});
    if (!merchant) {
      return res.status(404).json({
        message: "Merchant not found",
      });
    }

    // Check if OTP is expired
    if (merchant.otpExpiry < Date.now()) {
      return res.status(400).json({
        message: "OTP has expired, please request a new one",
      });
    }

    // Check if OTP matches
    if (merchant.otp !== otp) {
      merchant.otpAttempts += 1;
      await merchant.save();

      if (merchant.otpAttempts >= 3) {
        // Lock out the user after 3 failed attempts
        merchant.otp = undefined; // Invalidate OTP
        merchant.otpExpiry = undefined;
        merchant.otpAttempts = 0; // Reset attempts after lockout
        await merchant.save();

        return res.status(429).json({
          message:
            "Too many failed attempts. OTP has been invalidated. Please request a new OTP.",
        });
      }

      return res.status(400).json({
        message: `Invalid OTP. You have ${
          3 - merchant.otpAttempts
        } attempts left.`,
      });
    }

    // If OTP is correct, reset the attempt count and allow password reset
    merchant.otp = undefined;
    merchant.otpExpiry = undefined;
    merchant.otpAttempts = 0;
    merchant.isOtpVerified = true;
    await merchant.save();

    return res.status(200).json({
      message: "OTP verified successfully. You may now reset your password.",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error: ",
      error: error.message,
    });
  }
};

// Function to resend OTP for password reset
exports.resendOTPforResetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Find the merchant by email
    const merchant = await merchantModel.findOne({ email: email.toLowerCase()});
    if (!merchant) {
      return res.status(404).json({ message: "Merchant not found" });
    }

    // Generate a new OTP and set a 15-minute expiry
    const newOTP = generateOTP();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

    // Update merchant with new OTP and reset the attempt count
    merchant.otp = newOTP;
    merchant.otpExpiry = otpExpiry;
    merchant.otpAttempts = 0;
    await merchant.save();

    // Send email with the new OTP for password reset
    const subject = "New OTP for Password Reset";
    const name = `${merchant.firstName} ${merchant.lastName}`;
    const html = resetNotification(name, newOTP);

    await sendEmail({
      email: merchant.email,
      html,
      subject,
    });

    return res.status(200).json({
      message: "A new OTP has been sent to your email for password reset.",
    });
  } catch (error) {
    console.error("Error in resendOTPforResetPassword function:", error);
    return res.status(500).json({
      message: "Internal Server Error: ",
      error: error.message,
    });
  }
};

// Function to reset the Merchant password
exports.resetPassword = async (req, res) => {
  try {
    const validationResult = validateResetPassword(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return res.status(400).json({
        message: "Validation errors occurred",
        errors,
      });
    }

    // Extract userId from request parameters and passwords from request body
    const { email, password, confirmPassword } = req.body;

    // Check if password or confirmPassword are empty
    if (!email || !password || !confirmPassword) {
      return res.status(400).json({
        message: "Email, Password and Confirm Password cannot be empty",
      });
    }

    // Find the Merchant by email
    const merchant = await merchantModel.findOne({ email: email.toLowerCase()});
    if (!merchant) {
      return res.status(404).json({ message: "Merchant Company not found" });
    }

    // Check if OTP verification has been passed
    if (!merchant.isOtpVerified) {
      return res.status(400).json({
        message:
          "OTP verification has not been completed. Please verify your OTP first.",
      });
    }

    // Check if password and confirmPassword match
    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match",
      });
    }

    // If the Merchant already has a password, check if the new password is the same as the old password
    if (merchant.password && bcrypt.compareSync(password, merchant.password)) {
      return res.status(400).json({
        message: "Can't use previous password!",
      });
    }

    // Generate a salt and hash the new password
    const salt = bcrypt.genSaltSync(12);
    const hashPassword = bcrypt.hashSync(password, salt);

    // Update the Merchant password with the new hashed password
    const updateMerchant = await merchantModel.findByIdAndUpdate(
      merchant._id,
      { password: hashPassword },
      { new: true }
    );

    // Send a successful reset response
    // return res.send(resetSuccessfulHTML(req));
    return res.status(200).json({ message: "Password reset successful!" });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error: ",
      error: error.message,
    });
  }
};

// Function to signOut a Merchant
exports.signOut = async (req, res) => {
  try {
    const id = req.user.userId;
    const merchant = await merchantModel.findById(id);
    if (!merchant) {
      return res.status(404).json({
        message: "Merchant not found",
      });
    }

    merchant.token = null;
    await merchant.save();
    return res.status(201).json({
      message: `${merchant.businessName} has been signed out successfully`,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error: ",
      error: error.message,
    });
  }
};

// Get a user

exports.getUser = async (req, res) => {
  try {
    const { userId } = req.user;
    const merchant = await merchantModel.findById(userId);
    if (!merchant) {
      return res.status(404).json({
        message: "Merchant not found",
      });
    }

    // Exclude the password, otp etc
    const { password: _, otp, otpExpiry, otpAttempts, ...merchantDetails } = merchant.toObject();

    return res.status(200).json({
      message: "Merchant Profile successfully fetched!",
      data: merchantDetails,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error: ",
      error: error.message,
    });
  }
};

// get all users
exports.getAllMerchants = async (req, res) => {
  try {
    const merchants = await merchantModel.find();

    if (merchants.length === 0) {
      return res.status(404).json({
        message: "No merchants found",
      });
    }

    return res.status(200).json({
      message: `${merchants.length} merchant(s) found`,
      data: merchants,
    });
  } catch (error) {
    console.error("Error in getAllMerchants:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Function to upload a merchant photo
const uploadLogoToCloudinary = async (merchantPicture, merchant) => {
  try {
    if (merchant.merchantPicture && merchant.merchantPicture.public_id) {
      return await cloudinary.uploader.upload(merchantPicture, {
        public_id: merchant.merchantPicture.public_id,
        overwrite: true,
      });
    } else {
      return await cloudinary.uploader.upload(merchantPicture, {
        public_id: `merchantPic_${merchant._id}_${Date.now()}`,
        folder: "Merchant-Images",
      });
    }
  } catch (error) {
    throw new Error("Error uploading photo to Cloudinary: " + error.message);
  }
};

//Endpoint to upload a Merchant profile photo
exports.uploaAPhoto = async (req, res) => {
  try {
    const userId = req.user.userId;

    const merchant = await merchantModel.findById(userId);
    if (!merchant) {
      return res.status(404).json({
        message: "Merchant not found",
      });
    }

    // Upload image to Cloudinary if available
    if (!req.file) {
      return res.status(400).json({
        message: "No file was uploaded",
      });
    }

    // Path to the uploaded file
    const imageFilePath = path.resolve(req.file.path);

    // Check if the file exists before proceeding
    if (!fs.existsSync(imageFilePath)) {
      return res.status(400).json({
        message: "Uploaded image not found",
      });
    }

    // Upload the image to Cloudinary
    let fileUploader;
    try {
      fileUploader = await uploadLogoToCloudinary(imageFilePath, merchant);
      await fs.promises.unlink(imageFilePath);
    } catch (uploadError) {
      return res
        .status(500)
        .json({
          message: "Error uploading profile photo " + uploadError.message,
        });
    }

    if (fileUploader) {
      const merchantPicture = {
        public_id: fileUploader.public_id,
        url: fileUploader.secure_url,
      };

      const uploadedPhoto = await merchantModel.findByIdAndUpdate(
        userId,
        { merchantPicture: merchantPicture },
        { new: true }
      );
      if (!uploadedPhoto) {
        return res.status(400).json({
          message: "Unable to upload user photo!",
        });
      }

      return res.status(200).json({
        message: "Photo successfully uploaded!",
        profilePicture: uploadedPhoto.merchantPicture,
      });
    } else {
      return res.status(500).json({ message: "Failed to upload logo image" });
    }
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error: " + error.message,
    });
  } finally {
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(path.resolve(req.file.path));
    }
  }
};


// Function to complete merchant KYC verification
exports.merchantKYC = async (req, res) => {
  try {
    const {userId} = req.user;
    const merchant = await merchantModel.findById(userId);
    if (!merchant) return res.status(400).json({ message: "Merchant not found!" });

    const { BVN, CAC } = req.body;
    if (!BVN || !CAC) return res.status(400).json({ message: "Enter a valid BVN and CAC number" });

    // const [verifiedBVN, verifiedCAC] = await Promise.all([
    //   verifyBVNWithKoraPay(BVN),
    //   verifyCACWithKoraPay(CAC)
    // ]);

    // if (!verifiedBVN.isValid || verifiedBVN.first_name.toLowerCase() !== merchant.firstName.toLowerCase() || verifiedBVN.last_name.toLowerCase() !== merchant.lastName.toLowerCase()) {
    //   return res.status(400).json({ message: "BVN data does not match our records!" })
    // }

    // if (!verifiedCAC.isValid || verifiedCAC.name !== merchant.businessName) {
    //   return res.status(400).json({ message: "CAC data does not match our records!" })
    // }

    const merchantDetails = {
      email: merchant.email,
      businessName: merchant.businessName,
      bvn: BVN
    }

    const virtualAcct = await createVirtualAccount(merchantDetails, merchant.merchantId)
    if (!virtualAcct) {
      return res.status(400).json({ message: "Failed to create merchant virtual account!" })
    }

    // Save the merchant virtual account details to database 
    const bankDetails = {
      accountName: virtualAcct.account_name,
      accountNumber: virtualAcct.account_number,
      bankName: virtualAcct.bank_name,
      bankCode: virtualAcct.bank_code,
    }

    const updatedBankDetails = await merchantModel.findByIdAndUpdate(userId, { bankAccountDetails: bankDetails, isKYCverified: true }, {new: true});
    if (!updatedBankDetails) return res.status(400).json({ message: "Unable to update merchant bank details" });

    return res.status(200).json({ 
      message: "Merchant KYC verification successful!",
      data: bankDetails
    })

  } catch (error) {
    return res.status(500).json({
      message: "Internal server error: " + error.message,
      API_Error: error.response?.data || "No additional error details from API",
    });
  }
}


// Funtion to create / update merchant Auth PIN 
exports.createAuthPIN = async (req, res) => {
  try {
    const {userId} = req.user;
    const merchant = await merchantModel.findById(userId);
    if (!merchant) return res.status(400).json({ message: "Merchant not found!" });

    const { authPIN } = req.body;
    if (!authPIN) return res.status(400).json({ message: "Please enter your authentication PIN for transfer." });

    // Ensure authPIN is a string that contains exactly 4 digits
    if (!/^\d{4}$/.test(authPIN)) {
      return res.status(400).json({ message: "Authentication PIN must be a 4-digit number." });
    }

    const hashedPIN = await hashPIN(authPIN);

    merchant.authPIN = hashedPIN;
    await merchant.save();

    return res.status(201).json({ message: "Authentication PIN successfully set!" });

  } catch (error) {
    return res.status(500).json({
      message: "Internal server error: " + error.message,
    });
  }
};



exports.getMerchant = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const merchant = await merchantModel.findOne({merchantId: merchantId});
    if (!merchant) {
      return res.status(404).json({
        message: "Merchant not found",
      });
    }

    const merchantDetails =  {
      merchantId: merchant.merchantId,
      firstName: toTitleCase(merchant.firstName),
      lastName: toTitleCase(merchant.lastName),
      email: merchant.email,
      businessName: toTitleCase(merchant.businessName),
      phoneNumber: merchant.phoneNumber,
      AccountDetails: merchant.bankAccountDetails
    }

    return res.status(200).json({
      message: "Merchant details successfully fetched!",
      data: merchantDetails,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error: ",
      error: error.message,
    });
  }
};