const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12; // Increased from 10 for added security

// Function to hash sensitive data
async function hashSensitiveData(data) {
    return await bcrypt.hash(data, SALT_ROUNDS);
}

// Function to hash password
async function hashPassword(password) {
    return await bcrypt.hash(password, SALT_ROUNDS);
}

// Function to hash BVN
async function hashBVN(bvn) {
    return await hashSensitiveData(bvn);
}

// Function to hash CAC
async function hashCAC(cac) {
    return await hashSensitiveData(cac);
}

// Function to verify hashed data
async function verifyHash(plaintext, hash) {
    return await bcrypt.compare(plaintext, hash);
}

module.exports = {
    hashSensitiveData,
    hashPassword,
    hashBVN,
    hashCAC,
    verifyHash
};

































