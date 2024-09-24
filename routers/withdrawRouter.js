const express = require('express');
const router = express.Router();
const { withdrawFunds } = require('../controllers/withdrawalController');
const { authenticate, Admin, } = require('../middleware/authentication');


// Webhook Endpoint to verify payment
router.post('/withdraw', authenticate, withdrawFunds);

module.exports = router;
