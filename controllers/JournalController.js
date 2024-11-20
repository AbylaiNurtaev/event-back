import Journal from "../models/Journal.js";

// Функция для создания нового FAQ
export const createJournal = async (req, res) => {
  try {
    const { title, par, text } = req.body;

    // Создаем новый FAQ и сохраняем его в базе данных
    const newFaq = new Journal({
      title,
      par, // Дополнительный вопрос (если есть)
      text
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
    const { title, par, text } = req.body;

    // Находим и обновляем самую свежую запись
    const updatedFaq = await Journal.findOneAndUpdate(
      { _id: req.body.id }, // Пустой фильтр, чтобы найти первую запись
      { title, par, text }, // Новые данные
      { new: true } // Возвращаем обновлённую запись
    );

    if (!updatedFaq) {
      return res.status(404).json({ message: "FAQ не найден для обновления." });
    }

    res.status(200).json({ message: "FAQ успешно обновлен!", updatedFaq });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Произошла ошибка при обновлении FAQ" });
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