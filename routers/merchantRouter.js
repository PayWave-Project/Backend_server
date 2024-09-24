const express = require('express');
const router = express.Router();
const { registerMerchant, verify, logIn, forgotPassword, resetPassword, signOut, resendOTP, uploaAPhoto, verifyOTP, resendOTPforResetPassword, } = require('../controllers/merchantController');
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
router.post("/verify-otp/:id", verifyOTP);

//endpoint to resend OTP for Reset Password
router.get("/resend-password-otp/:id", resendOTPforResetPassword);

//endpoint to reset user Password
router.put('/reset-password/:id', resetPassword);

//endpoint to upload a profile photo
router.put('/upload-logo', upload.single('merchantPicture'), authenticate,  uploaAPhoto);


//endpoint to sign out a merchant
router.post("/signout-merchant/:id", authenticate, signOut);



module.exports = router;
