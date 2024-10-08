const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const paymentSchema = new Schema({
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
        required: true,
        enum: ['dynamic', 'static_custom', 'static_defined'],
    },
    duration: {
        type: Number,
    },
    date_Time: {
        type: Date,
        default: Date.now,
    },
    checkout_url: {
        type: String,
        required: true,
    },
    qrCode: {
        type: String,
    },
    expiresAt: { 
        type: Date, 
    },
}, { timestamps: true });

// Create TTL index on 'expiresAt' field
paymentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const paymentModel = mongoose.model('Payment', paymentSchema);

module.exports = paymentModel;
