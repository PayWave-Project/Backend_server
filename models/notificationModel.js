const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const notifySchema = new mongoose.Schema({
    merchant: { 
        type: Schema.Types.ObjectId, 
        ref: 'Merchant' 
    },
    email: {
        type: String,
        lowercase: true,
    },
    subject: {
        type: String,
    },
    message: {
        type: String,
    }, 
    date: {
        type: String,
    },
    time: {
        type: String,
    }
}, { timestamps: true });

const notificationModel = mongoose.model('Notifications', notifySchema);

module.exports = notificationModel;