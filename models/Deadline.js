import mongoose from "mongoose";

const DeadlineSchema = new mongoose.Schema({
    deadline: {
        type: String,  // Или другой тип, в зависимости от того, как вы хотите сохранять дедлайн (например, Date)
        required: true
    },
    deadline2: {
        type: String,  // Или другой тип, в зависимости от того, как вы хотите сохранять дедлайн (например, Date)
        required: true
    },
    month: {
        type: String,  // Или другой тип, в зависимости от того, как вы хотите сохранять дедлайн (например, Date)
        required: true
    },
    date: {
        type: String,
        required: true

    },
    
    dateJoury: {
        type: String,
        required: true

    },
    
    
}, {
    timestamps: true // Добавляет поля createdAt и updatedAt
})

export default mongoose.model('Deadline', DeadlineSchema);