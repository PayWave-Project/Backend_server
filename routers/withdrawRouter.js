const express = require('express');
const router = express.Router();
const { withdrawFunds, listBanks } = require('../controllers/withdrawalController');
const { authenticate, Admin, } = require('../middleware/authentication');


// Webhook Endpoint to verify payment
router.post('/withdraw', authenticate, withdrawFunds);

//Endpoint to save banks list in nigeria
router.get('/list-banks', listBanks);

module.exports = router;
