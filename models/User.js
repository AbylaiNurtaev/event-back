import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        // unique: true    
    },
    role: {
        type: String,
        required: true,
        default: "user"
    },
    company: String,
    name: String,
    nomination: String,
    job: String,
    about: String,
    instagram: String,
    youtube: String,
    vk: String,
    tiktok: String,
    verified: Boolean,
    logo: String,
    avatar: String,
    city: String,
    applications: [{
        type: mongoose.Schema.Types.Mixed,
        portfolio: [String],
        previews: [String],
        application_id: {
            type: String,
            required: true
          },
          documents: [String]
    }]
}, {
    timestamps: true,
});

export default mongoose.model('User', UserSchema);