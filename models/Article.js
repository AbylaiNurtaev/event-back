import mongoose from "mongoose";
// dasdasda
const ArticleSchema = new mongoose.Schema({
    titles: {
        type: [String],
        required: true
    },
    mainTitle: {
        type: String,
        required: true
    },
    content: {
        type: [String],
        required: true
    },

})

export default mongoose.model('Article', ArticleSchema);