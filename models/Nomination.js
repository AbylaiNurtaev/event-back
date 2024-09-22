import mongoose from "mongoose";

const NominationSchema = new mongoose.Schema({
    nomination: {
        type: [String],
        required: true
    },
    category: {
        type: String,
        required: true
    },
    information: [{
        text: {
            type: String,
        },
        percentage: {
            type: String,
        }
    }],
    multipleSelection: {
        type: Boolean,
        default: false
    },
    nameTitle: {
        type: String,
        default: "Проект"
    },
    command: {
        type: Boolean,
        default: false
    },
    fields: [{
        key: {
            type: String
        },
        value: {
            type: String
        }
    }],
    additionalFields: [{
        key: {
            type: String
        },
        value: {
            type: String
        }
    }]

})

export default mongoose.model('Nomination', NominationSchema);