const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const withdrawSchema = new Schema({
    merchant: { 
        type: Schema.Types.ObjectId, 
        ref: 'Merchant' 
    },
    email: {
        type: String,
        required: true
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
        required: true,
    },
    date_Time: {
        type: Date,
        default: Date.now,
    }
}, { timestamps: true });


const withdrawModel = mongoose.model('Withdrawal', withdrawSchema);

module.exports = withdrawModel;
