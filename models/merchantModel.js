const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const merchantSchema = new Schema({
    firstName: {
        type: String,
        lowercase: true,
        required: true
    },
    lastName: {
        type: String,
        lowercase: true,
        required: true
    },
    merchantId: {
        type: String,
    },
    businessName: {
        type: String,
        lowercase: true,
        required: true
    },
    email: {
        type: String,
        lowercase: true,
        required: true
    },
    phoneNumber: {
        type: String,
        required: true
    },
    password: {
        type: String, 
        required: true
    },
    otp: {
        type: String
    },
    otpExpiry: {
        type: Date
    },
    otpAttempts: {
        type: Number,
        default: 0
    },
    isOtpVerified: { 
        type: Boolean, 
        default: false 
    },
    BVN: {
        type: String,
    },
    CAC: {
        type: String,
    },
    transactionHistory: [{
        reference: { type: String },
        amount: { type: Number },
        status: { type: String },
        type: { type: String },
        date: { type: String },
        time: { type: String },
      }],
    
      notification: [{
        notificationMessage: { type: String },
        date: { type: String }, 
        time: { type: String },
      }],

    status: {
        type: String,
        lowercase: true,
        default: "not-verified"
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    isKYCverified: {
        type: Boolean,
        default: false
    },
    bankAccountDetails: {
        accountName: {
            type: String,
        },
        accountNumber: {
            type: String,
        },
        bankName: {
            type: String,
        },
        bankCode: {
            type: String,
        },
    },
    token: {
        type: String
    },
    merchantPicture: {
        url: {
            type: String
        },
        public_id: {
            type: String
        }
    },
    balance: {
        type: Number,
        default: 0
    },
    authPIN: {
        type: String,
    },

}, { timestamps: true });

const merchantModel = mongoose.model('Merchant', merchantSchema);

module.exports = merchantModel;