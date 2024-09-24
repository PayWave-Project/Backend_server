const express = require('express');
const router = express.Router();
const { registerMerchant, verify, logIn, forgotPassword, resetPassword, signOut, resendOTP, uploaAPhoto, } = require('../controllers/merchantController');
const { authenticate, Admin, } = require('../middleware/authentication');
const { upload } = require('../middleware/multer');

// Endpoint to register a new merchant
router.post('/register-merchant', registerMerchant);

//endpoint to verify a registered merchant
router.get('/verify-merchant/:id', verify)

// endpoint to resend otp
router.post('/resend-otp/:id',resendOTP);

//endpoint to login with email
router.post("/login-merchant", logIn);

//endpoint to reset user Password
router.put('/reset-password/:id', resetPassword);

//endpoint for forgot password
router.post("/forgot-password", forgotPassword);
//endpoint to upload a profile photo
router.put('/upload-logo', upload.single('merchantPicture'), authenticate,  uploaAPhoto);


//endpoint to sign out a merchant
router.post("/signout-merchant/:id", authenticate, signOut);



module.exports = router;
