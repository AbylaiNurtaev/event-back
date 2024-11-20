import Deadline from '../models/Deadline.js'

export const getDeadline = async (req, res) => {
    try {
        const posts = await Deadline.find();
        res.json(posts)
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Не удалось загрузить товары"
        })
    }
}


export const setDeadline = async (req, res) => {
    try {
        const { deadline, deadline2, month, date, dateJoury } = req.body;

        if (!deadline) {
            return res.status(400).json({
                message: "Не передан дедлайн"
            });
        }

        const newDeadline = new Deadline({
            deadline,
            deadline2,
            month,
            date,
            dateJoury
        });

        // Сохраняем данные и проверяем результат
        const savedDeadline = await newDeadline.save();
        console.log('Сохраненный дедлайн:', savedDeadline);

        res.status(201).json(savedDeadline);
    } catch (error) {
        console.log('Ошибка при сохранении дедлайна:', error);
        res.status(500).json({
            message: "Не удалось сохранить дедлайн"
        });
    }
};

