const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const transactionSchema = new Schema({
    merchant: { 
        type: Schema.Types.ObjectId, 
        ref: 'Merchant' 
    },
    email: {
        type: String,
        required: true
    },
    merchantId: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        required: true,
    },
    reference: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        enum: ["withdrawal", "Transfer", "Deposit", "Card"]
    },
    date_Time: {
        type: Date,
        default: Date.now,
    },

}, { timestamps: true });


const transactionModel = mongoose.model('transactions', transactionSchema);

module.exports = transactionModel;
