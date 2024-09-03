import mongoose from 'mongoose';
const UserOTPVerificationSchema  = new mongoose.Schema({
    userId: String,
    otp: String,
    createdAt: Date,
    expiresAt: Date

})


export default mongoose.model('UserOTPVerification', UserOTPVerificationSchema);