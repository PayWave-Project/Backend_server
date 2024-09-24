const express = require('express');
const router = express.Router();
const { webhook } = require('../controllers/webhook');


// Webhook Endpoint to verify payment
router.post('/webhook', webhook);

module.exports = router;
