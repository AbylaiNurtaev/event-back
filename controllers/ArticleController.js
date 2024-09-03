import ArticleModel from '../models/Article.js'

export const getAll = async (req, res) => {
    try {
        const posts = await ArticleModel.find();
        res.json(posts)
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Не удалось загрузить товары"
        })
    }
}

export const remove = async (req, res) => {
    const postTitle = req.params.name;

    try {
        const doc = await ArticleModel.findOneAndDelete({ mainTitle: postTitle });


        if (!doc) {
            return res.status(404).json({
                message: "Статья не найдена"
            });
        }

        res.json({
            success: true
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Не удалось удалить статью"
        });
    }
}

export const create = async (req, res) => {
    try {
        const doc = new ArticleModel({
            mainTitle: req.body.mainTitle,
            titles: req.body.titles,
            content: req.body.content,
        });

        const post = await doc.save();

        res.json(post)
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Не удалось создать товар"
        })
    }
}




export const updateInfo = async (req, res) => {
    const title = req.params.title;

    

    try {
        const doc = await ArticleModel.findOneAndUpdate(
            { mainTitle: title },
            {
                mainTitle: req.body.mainTitle,
                titles: req.body.titles,
                content: req.body.content,
            },
            { new: true }
        );

        if (!doc) {
            return res.status(404).json({
                message: "Товар не найден"
            });
        }

        res.json(doc);
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Не удалось обновить видимость товара"
        });
    }
};
