const express = require('express');
const router = express.Router();
const { registerMerchant, verify, logIn, forgotPassword, resetPassword, signOut, resendOTP, getUser, uploaAPhoto, verifyOTP, resendOTPforResetPassword, merchantKYC, } = require('../controllers/merchantController');
const { authenticate, Admin, } = require('../middleware/authentication');
const { upload } = require('../middleware/multer');

// Endpoint to register a new merchant
router.post('/register-merchant', registerMerchant);

//endpoint to verify a registered merchant
router.post('/verify-merchant/:id', verify)

// endpoint to resend otp
router.post('/resend-otp/:id',resendOTP);

//endpoint to login with email
router.post("/login-merchant", logIn);

//endpoint for forgot password
router.post("/forgot-password", forgotPassword);

//endpoint to verifyOTP for password reset
router.post("/verify-otp", verifyOTP);

//endpoint to resend OTP for Reset Password
router.post("/resend-password-otp", resendOTPforResetPassword);

//endpoint to reset user Password
router.put('/reset-password', resetPassword);

//endpoint to upload a profile photo
router.put('/upload-logo', upload.single('merchantPicture'), authenticate,  uploaAPhoto);

//endpoint to get a merchant profile
router.get("/get-merchant", authenticate, getUser);

//endpoint for merchant KYC verification
router.post('/merchant-kyc', authenticate, merchantKYC);


//endpoint to sign out a merchant
router.post("/signout-merchant/:id", authenticate, signOut);



module.exports = router;
