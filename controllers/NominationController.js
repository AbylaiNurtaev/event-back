import Nomination from '../models/Nomination.js'

export const getAll = async (req, res) => {
    try {
        const posts = await Nomination.find();
        res.json(posts)
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Не удалось загрузить товары"
        })
    }
}

export const remove = async (req, res) => {
    const id = req.params.id;

    try {
        const doc = await Nomination.findOneAndDelete({ _id: id });


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
        const doc = new Nomination({
            nomination: req.body.nomination,
            category: req.body.category,
            information: req.body.information,
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
    const id = req.params.id;

    

    try {
        const doc = await Nomination.findOneAndUpdate(
            { _id: id },
            {
                nomination: req.body.nomination,
                category: req.body.category,
                information: req.body.information,
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


export const modifyNomination = async (req, res) => {
    const id = req.params.id;

    

    try {
        const doc = await Nomination.findOneAndUpdate(
            { _id: id },
            {
                nameTitle: req.body.nameTitle,
                command: req.body.command,
                multipleSelection: req.body.multipleSelection,
                fields: req.body.fields,
                additionalFields: req.body.additionalFields
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
}