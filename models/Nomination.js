import mongoose from "mongoose";

const NominationSchema = new mongoose.Schema({
    nomination: {
        type: [String],
        required: true
    },
    category: {
        type: [String],
        required: true
    },
    information: [{
        text: {
            type: String,
        },
        percentage: {
            type: String,
        },
        moreText: String
    }],
    multipleSelection: {
        type: String,
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
    additionalFields: [[{
        key: {
            type: String
        },
        value: {
            type: String
        }
    }]],
    images: {
        type: Boolean,
        default: true
    },
    docs: {
        type: Boolean,
        default: true
    },
    videos: {
        type: Boolean,
        default: true
    },
    imagesText: {
        type: String,
        default: ''
    },
    docsText: {
        type: String,
        default: ''
    },
    videosText: {
        type: String,
        default: ''
    },
    par: {
        type: String,
        default: ''
    }, 
    criteria: {
        type: [
            {
                main: [
                    {
                        name: String,
                        grade: Number
                    }
                ],
                additional: [
                    {
                        name: String,
                        grade: Number
                    }
                ]
            }
        ]
    },
    moreText: String

})

export default mongoose.model('Nomination', NominationSchema);