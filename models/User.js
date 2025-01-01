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
    additionalJoury: {
        type: Boolean,
        default: false
    },
    vk: String,
    tiktok: String,
    verified: Boolean,
    phone: String,
    sait: String,
    logo: String,
    avatar: String,
    city: String,
    specialization: String,
    jouryCounter: {
        type: Number,
        default: 0
    },
    jouryRate: [{
        name: String,
        rating: Number,
        category: String,
        projectId: Number,
        jouryId: String,
        applicationId: String
    }],
    portfolio: [String],
    acceptedNominations: [String],
    balance: {
        type: Number,
        default: 0
    },
    order: { type: Number, default: 0 } ,
    applications: [{
        type: mongoose.Schema.Types.Mixed,
        portfolio: [String],
        previews: [String],
        accepted: {
            type: String,
            default: "false"
        },
        application_id: {
            type: String,
            required: true
          },
          documents: [String]
    }],
    liked: {
        default: [],
        type: [String]
    }
}, {
    timestamps: true,
});

export default mongoose.model('User', UserSchema);