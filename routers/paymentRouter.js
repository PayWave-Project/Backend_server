const express = require('express');
const router = express.Router();
const { generateQRCode, confirmPayment, scanQRCode, } = require('../controllers/paymentControllers');
const { authenticate, Admin, } = require('../middleware/authentication');
const { webhook } = require('../controllers/webhook');


// Endpoint to generate a payment QR Code for merchants
router.post('/pay/qrcode', authenticate, generateQRCode);

// Endpoint to the scan route
router.get('/scan/:reference', scanQRCode);

// Endpoint to confirm payment
router.post('/pay/confirm', authenticate, confirmPayment);

// Webhook Endpoint to verify payment
router.post('/webhook', webhook);

module.exports = router;
