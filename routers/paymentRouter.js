const express = require('express');
const router = express.Router();
const { generateQRCode, confirmPayment, scanDynamicQRCode, scanStaticCustomQRCode, scanStaticDefinedQRCode, } = require('../controllers/paymentControllers');
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


module.exports = router;
