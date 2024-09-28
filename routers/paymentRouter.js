const express = require('express');
const router = express.Router();
const { generateQRCode, confirmPayment, scanDynamicQRCode, scanStaticCustomQRCode, scanStaticDefinedQRCode, getMerchantTransactionHistory, getMerchantNotification, getMerchantAccountBalance, getMerchantAccountDetails, } = require('../controllers/paymentControllers');
const { authenticate, Admin, } = require('../middleware/authentication');


// Endpoint to generate a payment QR Code for merchants
router.post('/pay/qrcode', authenticate, generateQRCode);

// Endpoint to scan and handle dynamic QR code
router.get('/scan/dynamic/:reference', scanDynamicQRCode);

// Endpoint to scan and handle static custom QR code
router.post('/scan/static_custom/:reference', scanStaticCustomQRCode);

// Endpoint to scan and handle static defined QR code
router.get('/scan/static_defined/:reference', scanStaticDefinedQRCode);

// Endpoint to confirm payment
router.post('/pay/confirm', authenticate, confirmPayment);

// Endpoint to get Merchant Transaction History
router.get("/transaction-history", authenticate, getMerchantTransactionHistory);

// Endpoint to get Merchant Notifications
router.get("/notifications", authenticate, getMerchantNotification);

// Endpoint to get Merchant Account balance
router.get("/account-balance", authenticate, getMerchantAccountBalance);

//Endpoint to get Merchant Account details
router.get("/account-details", authenticate, getMerchantAccountDetails);


module.exports = router;
