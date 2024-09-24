const mongoose = require('mongoose');

const bankCodeSchema = new mongoose.Schema({
    name: {
        type: String,
    },
    slug: {
        type: String,
    },
    code: {
        type: String,
    }, 
    country: {
        type: String,
    },
    nibss_bank_code: {
        type: String,
    }
}, { timestamps: true });

const bankCodeModel = mongoose.model('Bank_Codes', bankCodeSchema);

module.exports = bankCodeModel;