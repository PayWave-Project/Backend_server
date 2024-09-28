const express = require('express');
const router = express.Router();
const { cardPay, cardAuthorize, cardResendOTPPay, bankTransferPay, sendMoney, verifyCustomersBankAccount, } = require('../controllers/paymentLogic');
const { authenticate, Admin, } = require('../middleware/authentication');


// Endpoint to make payment using card
router.post('/pay/card', authenticate, cardPay);

//Endpoint to authorize card if there is one
router.post('/pay/card/authorize', authenticate, cardAuthorize);

//Endpoint to Resend OTP for card authorization
router.post('/pay/card/resend-otp', authenticate, cardResendOTPPay);

//Endpoint to make payment using bank transfer
router.post('/pay/bank-transfer', authenticate, bankTransferPay);

//Endpoint to send money to bank account
router.post('/send-money', authenticate, sendMoney);

//Endpoint to verify customers bank account
router.post('/verify-bank', authenticate, verifyCustomersBankAccount);

module.exports = router;