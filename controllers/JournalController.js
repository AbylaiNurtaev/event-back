import Journal from "../models/Journal.js";
import mongoose from "mongoose";
// Функция для создания нового FAQ
export const createJournal = async (req, res) => {
  try {
    const { title, par, text, img } = req.body;

    // Создаем новый FAQ и сохраняем его в базе данных
    const newFaq = new Journal({
      title,
      par, // Дополнительный вопрос (если есть)
      text,
      img
    });

    await newFaq.save();

    res.status(201).json({ message: "FAQ успешно создан!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Произошла ошибка при создании FAQ" });
  }
};

// Функция для получения последнего FAQ
export const getLatestJournal = async (req, res) => {
  try {
    // Находим самую свежую запись, отсортированную по дате создания
    const latestFaq = await Journal.find();

    if (!latestFaq) {
      return res.status(404).json({ message: "FAQ не найден." });
    }

    res.status(200).json(latestFaq);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Произошла ошибка при получении FAQ" });
  }
};

// Функция для обновления последнего FAQ
export const updateJournal = async (req, res) => {
  try {
    const { id, title, par, text } = req.body;

    // Проверяем, является ли ID валидным ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Некорректный формат ID' });
    }

    if (!title || !text) {
      return res.status(400).json({ error: 'Необходимо указать title и text' });
    }

    // Находим и обновляем или создаём новую запись
    const updatedFaq = await Journal.findOneAndUpdate(
      { _id: id },
      { title, par, text },
      { new: true, upsert: true } // upsert создаёт запись, если её нет
    );

    res.status(200).json({ message: 'Журнал успешно обновлен!', updatedFaq });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Произошла ошибка при обновлении журнала' });
  }
};



export const deleteJournal = async (req, res) => {
    try {
      const { id } = req.body;
  
      // Ищем и удаляем запись по id
      const deletedFaq = await Journal.findByIdAndDelete(id);
  
      if (!deletedFaq) {
        return res.status(404).json({ message: "FAQ не найден для удаления." });
      }
  
      res.status(200).json({ message: "FAQ успешно удален!" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Произошла ошибка при удалении FAQ" });
    }
  };