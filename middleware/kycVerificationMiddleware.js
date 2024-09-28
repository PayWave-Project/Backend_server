const merchantModel = require("../models/merchantModel");


exports.kycVerificationMiddleware = async (req, res, next) => {
    const { userId } = req.user;
    
    const merchant = await merchantModel.findById(userId);
  
    if (!merchant) {
      return res.status(404).send({ message: 'Merchant not found' });
    }
  
    if (!merchant.isKYCverified || !merchant.isVerified || merchant.status !== 'verified') {
      return res.status(403).send({ message: 'KYC verification or account verification pending' });
    }
  
    next();
  }; 