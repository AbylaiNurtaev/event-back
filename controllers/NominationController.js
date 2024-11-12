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
            moreText: req.body.moreText
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
                moreText: req.body.moreText
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
                videos: req.body.videos,
                images: req.body.images,
                docs: req.body.docs,
                videosText: req.body.videosText,
                imagesText: req.body.imagesText,
                docsText: req.body.docsText,
                par: req.body.par,
                additionalFields: req.body.additionalFields,
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


// --------------------------------------------------------------------------------

export const addCriterion = async (req, res) => {
    const { nominationId, name, type } = req.body; // `type` может быть "main" или "additional"

    try {
        const nomination = await Nomination.findById(nominationId);

        if (!nomination) {
            return res.status(404).json({
                message: "Номинация не найдена"
            });
        }

        // Инициализируем массив criteria, если он не существует
        if (!nomination.criteria || nomination.criteria.length === 0) {
            nomination.criteria = [{ main: [], additional: [] }];
        }

        const criteriaType = type === 'main' ? nomination.criteria[0].main : nomination.criteria[0].additional;

        // Проверяем, есть ли критерий с таким названием
        if (criteriaType.some(criterion => criterion.name === name)) {
            return res.status(400).json({
                message: "Критерий с таким названием уже существует"
            });
        }

        // Добавляем новый критерий
        criteriaType.push({ name });

        await nomination.save();

        res.json({
            success: true,
            message: "Критерий успешно добавлен",
            nomination
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Не удалось добавить критерий"
        });
    }
};



export const editCriterion = async (req, res) => {
    const { nominationId, oldName, newName, type } = req.body; // `type` может быть "main" или "additional"

    try {
        const nomination = await Nomination.findById(nominationId);

        if (!nomination) {
            return res.status(404).json({
                message: "Номинация не найдена"
            });
        }

        // Инициализируем массив criteria, если он не существует
        if (!nomination.criteria || nomination.criteria.length === 0) {
            return res.status(404).json({
                message: "Критерии не найдены"
            });
        }

        const criteriaType = type === 'main' ? nomination.criteria[0].main : nomination.criteria[0].additional;

        const criterionIndex = criteriaType.findIndex(criterion => criterion.name === oldName);

        // Если критерий не найден
        if (criterionIndex === -1) {
            return res.status(404).json({
                message: "Критерий не найден"
            });
        }

        // Обновляем название критерия
        criteriaType[criterionIndex].name = newName;

        await nomination.save();

        res.json({
            success: true,
            message: "Критерий успешно обновлен",
            nomination
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Не удалось обновить критерий"
        });
    }
};



export const deleteCriterion = async (req, res) => {
    const { nominationId, name, type } = req.body; // `type` может быть "main" или "additional"

    try {
        const nomination = await Nomination.findById(nominationId);

        if (!nomination) {
            return res.status(404).json({
                message: "Номинация не найдена"
            });
        }

        // Инициализируем массив criteria, если он не существует
        if (!nomination.criteria || nomination.criteria.length === 0) {
            return res.status(404).json({
                message: "Критерии не найдены"
            });
        }

        const criteriaType = type === 'main' ? nomination.criteria[0].main : nomination.criteria[0].additional;

        const criterionIndex = criteriaType.findIndex(criterion => criterion.name === name);

        // Если критерий не найден
        if (criterionIndex === -1) {
            return res.status(404).json({
                message: "Критерий не найден"
            });
        }

        // Удаляем критерий
        criteriaType.splice(criterionIndex, 1);

        await nomination.save();

        res.json({
            success: true,
            message: "Критерий успешно удален",
            nomination
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Не удалось удалить критерий"
        });
    }
};

