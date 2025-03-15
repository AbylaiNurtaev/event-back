import express from 'express';
import mongoose from 'mongoose';
import chalk from 'chalk';
import handleValidationErrors from './utils/handleValidationErrors.js';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs'
dotenv.config();
import crypto from 'crypto'
import nodemailer from 'nodemailer'

import sharp from 'sharp';

import cors from 'cors'
import * as UserController from './controllers/UserController.js'
import * as NominationController from './controllers/NominationController.js'
import * as DeadlineController from './controllers/DeadlineController.js'
import jwt from 'jsonwebtoken'

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import checkAuth from './utils/checkAuth.js';
import { ArticleController } from './controllers/index.js';
import * as JournalController from './controllers/JournalController.js'

import checkAdmin from './utils/checkAdmin.js';

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import User from './models/User.js';
import Journal from './models/Journal.js';
import { fileURLToPath } from 'url';

import axios from 'axios'
const bucketName = process.env.BUCKET_NAME
const bucketRegion = process.env.BUCKET_REGION
const accesskey = process.env.ACCESS_KEY
const secretAccessKey = process.env.SECRET_ACCESS_KEY


const s3 = new S3Client({
  credentials: {
    accessKeyId: accesskey,
    secretAccessKey: secretAccessKey
  },
  region: bucketRegion
})





const errorMsg = chalk.bgWhite.redBright;
const successMsg = chalk.bgGreen.white;

const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex')
const auth = {
  user: process.env.USER1,
  pass: process.env.PASS
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  port: 587,

  auth: {
    user: auth.user,
    pass: auth.pass,
  },
  secure: false, // Используем безопасное соединение
});

const verifyTransporter = async () => {
  try {
    await transporter.verify();
    console.log('SMTP сервер готов для отправки сообщений');
  } catch (error) {
    console.error('Ошибка при проверке соединения SMTP:', error);
    throw error;
  }
};

// mongoose.connect(process.env.MONGODB_URI)
mongoose.connect('mongodb+srv://wedsastana:20060903@cluster0.h2di1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')

.then(() => console.log(successMsg("DB ok")))
.catch((err) => console.log(errorMsg("DB error:", err)))

const app = express();

// app.use(cors({
//   origin: 'https://weds.kz', // Укажите домен вашего фронтенда
//   methods: ['GET','PATCH', 'POST', 'PUT', 'DELETE'],
//   credentials: true, // Если нужны куки или авторизация
// }));
app.use(cors());



app.use(express.json());

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })


const generateFileHash = () => crypto.randomBytes(32).toString("hex");

// Функция извлечения хэша из URL
const extractHashFromUrl = (url) => {
    const parts = url.split("/");
    return parts[parts.length - 1].split("?")[0]; // Убираем параметры запроса (если есть)
};


app.post('/api/uploadPortfolio/:id', upload.array('newImages', 50), async (req, res) => {
  try {
    const { id } = req.params;
    const { application_id, orderedPortfolio, newFileIndexes } = req.body;
    const newFiles = req.files || [];

    console.log(`Загружено файлов: ${newFiles.length}`);
    console.log(`OrderedPortfolio: ${orderedPortfolio}`);

    let orderedPortfolioArray = JSON.parse(orderedPortfolio); // Восстанавливаем структуру
    let newFileIndexesArray = JSON.parse(newFileIndexes); // Индексы новых файлов

    let uploadedHashes = [];

    // Загружаем новые файлы в S3
    for (const file of newFiles) {
      const buffer = await sharp(file.buffer).toBuffer();
      const fileHash = generateFileHash(); // Генерируем уникальный хэш

      const params = {
        Bucket: bucketName,
        Key: fileHash,
        Body: buffer,
        ContentType: file.mimetype,
      };

      const command = new PutObjectCommand(params);
      await s3.send(command);

      uploadedHashes.push(fileHash);
    }

    // Заменяем "NEW_FILE" на загруженные хэши в `orderedPortfolioArray`
    newFileIndexesArray.forEach(({ groupIndex, fileIndex }, index) => {
        orderedPortfolioArray[groupIndex][fileIndex] = uploadedHashes[index];
    });

    // Обрабатываем `orderedPortfolioArray`: заменяем ссылки на хэши
    orderedPortfolioArray = orderedPortfolioArray.map((group) =>
      group.map((item) => (typeof item === "string" ? extractHashFromUrl(item) : item))
    );

    // 1. Проверяем, существует ли пользователь
    let user = await User.findOne({ _id: id });

    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    // 2. Обновляем или создаём заявку
    const updatedUser = await User.findOneAndUpdate(
      { _id: id, "applications.application_id": application_id },
      {
        $set: { "applications.$.portfolio": orderedPortfolioArray }
      },
      { new: true }
    );

    // 3. Если заявки не было – создаём новую
    if (!updatedUser) {
      await User.findOneAndUpdate(
        { _id: id },
        {
          $push: {
            applications: {
              application_id: application_id,
              portfolio: orderedPortfolioArray
            }
          }
        },
        { new: true }
      );
    }

    res.json({
      message: "Файлы успешно загружены",
      portfolio: orderedPortfolioArray,
    });

  } catch (error) {
    console.error("Ошибка загрузки фотографий:", error);
    res.status(500).json({ message: "Ошибка загрузки фотографий" });
  }
});





app.post('/api/uploadDocuments/:id', upload.array('documents', 50), async (req, res) => {
  try {
    const id = req.params.id;
    const application_id = req.body.application_id;

    const files = req.files; // Получаем массив файлов
    const uploadedDocuments = [];

    for (let file of files) {
      const documentName = file.originalname; // Используем оригинальное имя файла

      const params = {
        Bucket: bucketName,
        Key: documentName,
        Body: file.buffer, // Загружаем файл напрямую
        ContentType: file.mimetype // Указываем тип файла
      };

      const command = new PutObjectCommand(params);
      await s3.send(command);

      uploadedDocuments.push(documentName); // Добавляем имя файла в массив загруженных документов
    }

    // Проверяем, есть ли заявка с таким application_id
    let user = await User.findOne({ _id: id, "applications.application_id": application_id });

    if (user) {
      // Если заявка существует, добавляем новые документы к существующим
      await User.findOneAndUpdate(
        { _id: id, "applications.application_id": application_id },
        { $push: { "applications.$.documents": { $each: uploadedDocuments } } }, // Используем $push с $each для добавления новых документов
        { new: true }
      );
    } else {
      // Если заявки нет, создаем новую
      user = await User.findOneAndUpdate(
        { _id: id },
        { $push: { applications: { application_id: application_id, documents: uploadedDocuments } } }, // Пушим новую заявку с новыми документами
        { new: true }
      );
    }

    res.json({ message: 'Документы успешно загружены', documents: uploadedDocuments });
  } catch (error) {
    console.error('Ошибка загрузки документов:', error);
    res.status(500).json({ message: 'Ошибка загрузки документов' });
  }
});


app.delete('/api/deleteDocument/:id/:application_id/:index', async (req, res) => {
  try {
    const { id, application_id, index } = req.params;

    // Находим пользователя с заявкой
    let user = await User.findOne({ _id: id, "applications.application_id": application_id });

    if (!user) {
      return res.status(404).json({ message: 'Пользователь или заявка не найдены' });
    }

    // Находим нужную заявку
    const application = user.applications.find(app => app.application_id === application_id);

    if (!application) {
      return res.status(404).json({ message: 'Заявка не найдена' });
    }

    // Проверяем, что индекс документа существует
    if (index < 0 || index >= application.documents.length) {
      return res.status(400).json({ message: 'Неверный индекс документа' });
    }

    const documentName = application.documents[index];

    // Удаляем документ из S3
    const deleteParams = {
      Bucket: bucketName,
      Key: documentName,
    };

    const command = new DeleteObjectCommand(deleteParams);
    await s3.send(command);

    // Удаляем документ из массива
    application.documents.splice(index, 1);

    // Сохраняем обновлённый массив документов в базе данных
    await User.findOneAndUpdate(
      { _id: id, "applications.application_id": application_id },
      { $set: { "applications.$.documents": application.documents } }, // Обновляем документы в нужной заявке
      { new: true }
    );

    res.json({ message: 'Документ успешно удалён', documents: application.documents });
  } catch (error) {
    console.error('Ошибка удаления документа:', error);
    res.status(500).json({ message: 'Ошибка удаления документа' });
  }
});

app.delete('/api/deletePortfolio/:id/:application_id/:sectionIndex/:fileIndex', async (req, res) => {
  try {
    const { id, application_id, sectionIndex, fileIndex } = req.params;
    console.log("Удаление файла:", id, application_id, sectionIndex, fileIndex);

    let user = await User.findOne({ _id: id, "applications.application_id": application_id });

    if (!user) {
      return res.status(404).json({ message: "Пользователь или заявка не найдены" });
    }

    const application = user.applications.find(app => app.application_id === application_id);

    if (!application) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    if (!application.portfolio[sectionIndex] || !application.portfolio[sectionIndex][fileIndex]) {
      return res.status(400).json({ message: "Неверный индекс элемента портфолио" });
    }

    const portfolioItem = application.portfolio[sectionIndex][fileIndex];

    // Удаляем изображение из S3 (если хранится в облаке)
    const deleteParams = {
      Bucket: bucketName,
      Key: portfolioItem,
    };
    const command = new DeleteObjectCommand(deleteParams);
    await s3.send(command);

    // Удаляем элемент из массива в нужной секции
    application.portfolio[sectionIndex].splice(fileIndex, 1);

    // Обновляем данные в базе
    await User.findOneAndUpdate(
      { _id: id, "applications.application_id": application_id },
      { $set: { "applications.$.portfolio": application.portfolio } },
      { new: true }
    );

    res.json({
      message: "Элемент портфолио успешно удалён",
      portfolio: application.portfolio,
    });

  } catch (error) {
    console.error("Ошибка удаления элемента портфолио:", error);
    res.status(500).json({ message: "Ошибка удаления элемента портфолио" });
  }
});








app.post('/api/uploadPreview/:id', upload.array('images', 10), async (req, res) => {
  try {
    const id = req.params.id;
    const application_id = req.body.application_id

    
    const files = req.files; // Получаем массив файлов
    const uploadedImages = [];

    for (let file of files) {
      const buffer = await sharp(file.buffer).toBuffer(); // Обрабатываем изображение через sharp
      const imageName = randomImageName(); // Генерируем имя для изображения

      const params = {
        Bucket: bucketName,
        Key: imageName, 
        Body: buffer,
        ContentType: file.mimetype
      };

      const command = new PutObjectCommand(params);
      await s3.send(command);

      await uploadedImages.push(imageName); // Добавляем имя изображения в массив загруженных файлов
    }

    
    let user = await User.findOneAndUpdate(
      { _id: id, "applications.application_id": application_id },
      { $push: { "applications.$.previews": { $each: uploadedImages } } }, // Обновление, если есть такой application_id
      { new: true }
    );
    
    if (!user) {
      // Если заявки с таким application_id нет, создаём новую заявку
      user = await User.findOneAndUpdate(
        { _id: id },
        { $push: { applications: { application_id: application_id, previews: uploadedImages } } }, // Пушим новый объект заявки
        { new: true }
      );
    }

    res.json({ message: 'Фотографии успешно загружены', images: uploadedImages, user: user });
  } catch (error) {
    console.error('Ошибка загрузки фотографий:', error);
    res.status(500).json({ message: 'Ошибка загрузки фотографий' });
  }
});

app.delete('/api/removePreview/:id/:application_id/:index', async (req, res) => {
  try {
    const { id, application_id, index } = req.params;

    // Находим пользователя и заявку с нужным application_id
    let user = await User.findOne({ _id: id, "applications.application_id": application_id });
    
    if (!user) {
      return res.status(404).json({ message: 'Пользователь или заявка не найдены' });
    }

    const application = user.applications.find(app => app.application_id === application_id);
    
    if (!application) {
      return res.status(404).json({ message: 'Заявка не найдена' });
    }

    const previews = application.previews;

    // Проверяем, существует ли изображение с таким индексом
    if (index < 0 || index >= previews.length) {
      return res.status(400).json({ message: 'Неверный индекс изображения' });
    }

    // Получаем имя изображения, которое нужно удалить
    const imageName = previews[index];

    // Удаляем изображение из S3
    const deleteParams = {
      Bucket: bucketName,
      Key: imageName
    };

    const deleteCommand = new DeleteObjectCommand(deleteParams);
    await s3.send(deleteCommand);

    // Удаляем изображение из массива previews
    previews.splice(index, 1);

    // Обновляем базу данных
    await User.findOneAndUpdate(
      { _id: id, "applications.application_id": application_id },
      { $set: { "applications.$.previews": previews } },
      { new: true }
    );

    res.json({ message: 'Изображение успешно удалено', previews });
  } catch (error) {
    console.error('Ошибка удаления изображения:', error);
    res.status(500).json({ message: 'Ошибка удаления изображения' });
  }
});


app.get('/getJouries', UserController.getJouries)
app.post('/deleteJoury', UserController.deleteJoury)
app.post('/sendReligionMail', UserController.sendReligionMail)


app.post('/createApplication', async (req, res) => {
  const application_id = req.body.application_id;
  const id = req.body.id;

  try {
    // Попробуем обновить существующую заявку
    let user = await User.findOneAndUpdate(
      { _id: id, "applications.application_id": application_id },
      { $set: { "applications.$.application_data": req.body.application } }, // Обновление существующей заявки
      { new: true }
    );

    const isNew = req.body.isNew

    // Если заявка с таким application_id не найдена, создаём новую
    if (!user) {
      user = await User.findOneAndUpdate(
        { _id: id },
        { $push: { applications: { application_id: application_id, application: req.body.application } } }, // Добавляем новую заявку
        { new: true }
      );
    }

    // Если пользователь найден и заявка обновлена/создана, уменьшаем баланс
    if (user && isNew && user.balance > 0) {
      user.balance -= 1; // Вычитаем 1 балл
      await user.save();  // Сохраняем изменения в базе данных

      try {
          const mailOptions = {
              from: auth.user,
              to: user.email,
              subject: "WEDS RATING🔥",
              html: `<img src="https://i.imgur.com/qJax1GC.png" alt="Verification Code Image" style="width: 100%; max-width: 600px;">
              <p><b style="font-size: 18px;">Поздравляем! Вы успешно подали заявку в WEDS RATING🔥</b></p>
              `
          }
          await verifyTransporter()
          await transporter.sendMail(mailOptions);
      } catch (error) {
          console.log(error)
      }
      
      res.json({ user, message: "Заявка успешно добавлена, баланс уменьшен" });
    }
    else if(user && !isNew){
      res.json({ user, message: "Заявка успешно добавлена, баланс не уменьшен" });
    }
    else if (user && user.balance <= 0) {
      res.status(400).json({ message: "Недостаточно баллов для создания заявки" });
    } else {
      res.status(404).json({ message: "Пользователь не найден" });
    }
  } catch (error) {
    console.error('Ошибка при добавлении заявки:', error);
    res.status(500).json({ message: 'Ошибка при добавлении заявки' });
  }
});



app.post('/send', async (req, res) => {
  
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    port: 587,
    // secure: true, // true для 465, false для других портов
    auth: {
        user: 'test@surfchat.ru', // Ваш email
        pass: '3sgdljh3dgshil3lhigds' // Ваш пароль
    },
    secure: false, 
});
const verifyTransporter = async () => {
  try {
    await transporter.verify();
    console.log('SMTP сервер готов для отправки сообщений');
  } catch (error) {
    console.error('Ошибка при проверке соединения SMTP:', error);
    throw error;
  }
};
await verifyTransporter()
// Определяем параметры письма
let mailOptions = {
    from: 'test@surfchat.ru', // От кого
    to: 'krutyev6@gmail.com', // Кому (можете указать несколько адресов через запятую)
    subject: 'Тема письма', // Тема письма
    text: 'Это текстовое сообщение.', // Текстовое сообщение
    html: '<b>Это текстовое сообщение в формате HTML.</b>' // HTML сообщение
};

// Отправляем письмо
await transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        return console.log('Ошибка при отправке: ' + error.message);
    }
    console.log('Письмо отправлено: ' + info.response);
});
})


app.post('/updateApplication', async (req, res) => {
  const { application_id, id, application } = req.body;

  try {
    // Найти пользователя с нужной заявкой
    const user = await User.findOne({ _id: id, "applications.application_id": application_id });

    if (!user) {
      return res.status(404).json({ message: "Заявка или пользователь не найдены" });
    }

    // Обновление заявки
    const updatedUser = await User.findOneAndUpdate(
      { _id: id, "applications.application_id": application_id },
      { $set: { "applications.$.application_data": application } }, // Обновление конкретной заявки
      { new: true }
    );

    res.json({ user: updatedUser, message: "Заявка успешно обновлена" });
  } catch (error) {
    console.error('Ошибка при обновлении заявки:', error);
    res.status(500).json({ message: 'Ошибка при обновлении заявки' });
  }
});


app.get('/getAllUsers', async (req, res) => {
  try {
    let users = await User.find();

    // Создаем объект, где ключ - email, а значение - пользователь с наибольшим балансом
    let filteredUsers = {};

    users.forEach(user => {
      const email = user.email.toLowerCase(); // Приводим email к нижнему регистру
      if (!filteredUsers[email] || user.balance > filteredUsers[email].balance) {
        filteredUsers[email] = user;
      }
    });

    // Преобразуем объект обратно в массив
    users = Object.values(filteredUsers);

    res.json(users);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Ошибка при получении пользователей' });
  }
});



app.get('/getAllUsersWithAvatars', async (req, res) => {
  try {
    let users = await User.find();
    
    const usersWithAvatars = await Promise.all(
      users.map(async (user) => {
        const avatarUrl = await getSignedUrlForKey(user.avatar);

        // Извлекаем портфолио из всех заявок пользователя
        const allPortfolios = user?.applications?.flatMap(app => app?.portfolio?.[0] || []) || [];

        // Берем не более 5 элементов
        const portfolioLength = Math.min(allPortfolios.length, 5);
        const portfolio = await Promise.all(
          allPortfolios.slice(0, portfolioLength).map((elem) => getSignedUrlForKey(elem))
        );
        user.portfolio = portfolio

        return {
          ...user.toObject(),
          avatarUrl,
          portfolio
        };
      })
    );

    res.json(usersWithAvatars);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});



app.post('/getApplication', async (req, res) => {
  const application_id = req.body.application_id;
  const id = req.body.id;

  try {
    let user = await User.findOne({ _id: id })
    if(!user){
      res.json({message: "Не найдена заявка"})
    }else{
      let application = await user.applications.find((elem) => elem.application_id == application_id)
      if(application){
        res.json(application)
      }else{
        res.json({message: "Не существует id данной заявки"})
      }
    }
  } catch (error) {
    console.log(error)
  }
})



app.post('/auth/getAllInfo', async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.body.userId });
    const application_id = req.body.application_id;

    if (!user) {
      return res.json({ message: "Пользователь не найден" });
    }

    // Ищем заявку с нужным application_id
    const application = user.applications.find(app => app.application_id == application_id);


    if (!application) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    // Создаем пустой объект для хранения всех ссылок
    const allInfo = {};
    // Конвертируем portfolio
    if (application.portfolio && application.portfolio.length > 0) {
      const portfolioUrls = await Promise.all(
        application.portfolio.map(async (group) => {
          if (!Array.isArray(group)) return []; // Если по ошибке не массив, пропускаем
          const urls = await Promise.all(group.map(async (key) => await getSignedUrlForKey(key)));
          return urls;
        })
      );
    
      allInfo.portfolio = portfolioUrls;
    }
    

    // Конвертируем previews
    if (application.previews && application.previews.length > 0) {
      const previewsUrls = await Promise.all(application.previews.map(async (key) => {
        const url = await getSignedUrlForKey(key);
        return url;
      }));
      allInfo.previews = previewsUrls;
    }

    // Конвертируем documents
    if (application.documents && application.documents.length > 0) {
      const documentsUrls = await Promise.all(application.documents.map(async (key) => {
        const url = await getSignedUrlForKey(key);
        return url;
      }));
      allInfo.documents = documentsUrls;
    }

    // Добавляем информацию о пользователе
    allInfo.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      about: user.about,
      liked: user.liked,
      avatar: user.avatar ? await getSignedUrlForKey(user.avatar) : null,
      logo: user.logo ? await getSignedUrlForKey(user.logo) : null
    };

    // Генерация токена
    const token = jwt.sign({ _id: user._id }, 'secret123', { expiresIn: "30d" });

    // Отправляем ответ с полной информацией о пользователе и его заявке
    res.json({
      ...allInfo,
      application_data: application.application_data, // Включаем данные заявки
      token,
    });

  } catch (err) {
    console.error('Ошибка при получении полной информации о пользователе:', err);
    res.status(500).json({
      message: "Ошибка при получении данных пользователя"
    });
  }
});

// Вспомогательная функция для генерации подписанной ссылки
async function getSignedUrlForKey(key) {
  const getObjectParams = {
    Bucket: bucketName,
    Key: key
  };
  const command = new GetObjectCommand(getObjectParams);
  try {
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    return url;
  } catch (err) {
    console.error('Ошибка при генерации подписанной ссылки:', err);
    return null;
  }
}


app.get('/getJouriesWithAvatars', async (req, res) => {
  try {
    // Находим всех пользователей с ролью "joury"
    let users = await User.find({ role: "joury" });

    // Для каждого жюри генерируем подписанную ссылку на аватар
    const usersWithAvatars = await Promise.all(
      users.map(async (user) => {
        // Предполагается, что путь к аватару хранится в user.avatarKey
        const avatarUrl = await getSignedUrlForKey(user.avatar);

        return {
          ...user.toObject(), // Преобразуем mongoose объект в обычный объект
          avatarUrl, // Добавляем ссылку на аватар
        };
      })
    );

    res.json(usersWithAvatars);

  } catch (error) {
    console.error('Ошибка при получении жюри:', error);
    res.status(500).json({
      message: "Ошибка на сервере",
    });
  }
})

app.post('/updateJouryOrder', UserController.updateJouryOrder)



app.post('/auth/getAllInfoPerson', async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.body.userId });

    if (!user) {
      return res.json({ message: "Пользователь не найден" });
    }

    const getSignedUrlForKey = async (key) => {
      const getObjectParams = {
        Bucket: bucketName,
        Key: key,
      };
      const command = new GetObjectCommand(getObjectParams);
      return await getSignedUrl(s3, command, { expiresIn: 3600 });
    };

    // Конвертируем avatar
    if (user.avatar) {
      user.avatar = await getSignedUrlForKey(user.avatar);
    }

    // Конвертируем logo
    if (user.logo) {
      user.logo = await getSignedUrlForKey(user.logo);
    }

    // Конвертируем portfolio
    if (user.portfolio && user.portfolio.length > 0) {
      const portfolioUrls = await Promise.all(
        user.portfolio.map(async (key) => await getSignedUrlForKey(key))
      );
      user.portfolio = portfolioUrls;
    }

    // Конвертируем documents
    if (user.documents && user.documents.length > 0) {
      const documentUrls = await Promise.all(
        user.documents.map(async (key) => await getSignedUrlForKey(key))
      );
      user.documents = documentUrls;
    }

    // Генерация токена (если требуется)
    const token = jwt.sign(
      {
        _id: user._id,
      },
      'secret123',
      {
        expiresIn: "30d",
      }
    );

    // Удаляем ненужные данные перед отправкой пользователю
    const { password, ...userData } = user._doc;

    res.json({
      ...userData,
      token,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Ошибка при получении данных пользователя",
    });
  }
});


app.post('/auth/payment', async (req, res) => {
  const userId = req.body.id;
  const price = req.body.price;

  try {
    // Получаем пользователя из базы данных
    let user = await User.findOne({ _id: userId });

    // Если пользователь найден
    if (user) {
      // Обновляем баланс пользователя, прибавляя сумму оплаты
      user.balance += price;

      // Сохраняем изменения
      await user.save();

      // Отправляем успешный ответ
      res.json({ message: "success", newBalance: user.balance });
    } else {
      // Если пользователь не найден, отправляем сообщение об ошибке
      res.status(404).json({ message: "Пользователь не найден" });
    }
  } catch (error) {
    // Логируем ошибку и отправляем сообщение об ошибке
    console.log(error);
    res.status(500).json({ message: "Не удалось провести оплату, свяжитесь с администрацией" });
  }
});


app.post('/auth/getBalance', async (req, res) => {
  const userId = req.body.id;

  try {
    // Получаем пользователя из базы данных
    let user = await User.findOne({ _id: userId });

    // Если пользователь найден
    if (user && user.balance > 0) {
      // Обновляем баланс пользователя, прибавляя сумму оплаты

      // Отправляем успешный ответ
      res.json({ message: "success", newBalance: user.balance });
    } else {
      // Если пользователь не найден, отправляем сообщение об ошибке
      res.json({ message: "no money" });
    }
  } catch (error) {
    // Логируем ошибку и отправляем сообщение об ошибке
    console.log(error);
    res.status(500).json({ message: "Не удалось провести оплату, свяжитесь с администрацией" });
  }
});


app.post('/auth/getUser', async (req, res) => {
  try {
      const user = await User.findOne({ _id: req.body.userId });
      const type = req.body.type; // Получаем тип (avatar, logo, portfolio)

      if (!user) {
        return res.json({ message: "Пользователь не найден" });
      }

      if (!['avatar', 'logo', 'portfolio', 'documents'].includes(type)) {
        return res.json(user);
      }

      // Если запрашиваем портфолио
      if (type === 'portfolio') {
        if (!user.portfolio || user.portfolio.length === 0) {
          return res.json({ message: "Портфолио не найдено" });
        }

        // Генерация ссылок для каждого изображения в портфолио
        const portfolioUrls = await Promise.all(user.portfolio.map(async (key) => {
          const getObjectParams = {
            Bucket: bucketName,
            Key: key
          };
          const command = new GetObjectCommand(getObjectParams);
          const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // Можно сделать ссылки постоянными
          return url;
        }));

        user.portfolio = portfolioUrls;
      }
      else if( type == "documents" ){
        if (!user.documents || user.documents.length === 0) {
          return res.json({ message: "documents не найдено" });
        }

        // Генерация ссылок для каждого изображения в портфолио
        const portfolioUrls = await Promise.all(user.documents.map(async (key) => {
          const getObjectParams = {
            Bucket: bucketName,
            Key: key
          };
          const command = new GetObjectCommand(getObjectParams);
          const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // Можно сделать ссылки постоянными
          return url;
        }));

        user.documents = portfolioUrls;
      }
      else {
        // Генерация ссылки для avatar или logo
        const key = user[type]; // Динамически получаем поле avatar или logo

        if (!key) {
          return res.json( user );
        }

        const getObjectParams = {
          Bucket: bucketName,
          Key: key
        };

        const command = new GetObjectCommand(getObjectParams);
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        user[type] = url;
      }

      const token = jwt.sign({
          _id: user._id,
      }, 'secret123', {
          expiresIn: "30d",
      });

      const { ...userData } = user._doc;
      console.log(token)
      

      res.json({
          ...userData,
          token,
      });

  } catch (err) {
      console.log(err);
      res.status(500).json({
          message: "Ошибка при получении данных пользователя"
      });
  }
});


app.post('/auth/getUserByToken', handleValidationErrors, UserController.getUserByToken)
app.post('/auth/register', handleValidationErrors, UserController.register)

app.post('/auth/verifyOTP', UserController.verifyOTP)
app.post('/auth/resendOTP', UserController.resendOTP)
app.post('/accessApplication', UserController.accessApplication)

app.post('/uploadFile/:id', upload.single('image'), async (req, res) => {
  const userId = req.params.id;
  const type = req.body.type; // Получаем тип (avatar или logo) 
  
  if (!['avatar', 'logo'].includes(type)) {
    return res.status(400).json({ message: "Invalid type" });
  }

  const oldUser = await User.findOne({ _id: userId });
  const oldImage = oldUser[type]; // Используем динамическое поле

  // Удаляем старое изображение, если оно есть
  if(oldImage && oldImage.length >= 1){
    const commandDelete = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: oldImage
    });
    await s3.send(commandDelete);
  }

  const buffer = await sharp(req.file.buffer).toBuffer();
  const imageName = randomImageName();

  const params = {
    Bucket: bucketName,
    Key: imageName,
    Body: buffer,
    ContentType: req.file.mimetype
  };

  const command = new PutObjectCommand(params);
  await s3.send(command);

  try {
      // Обновляем поле (avatar или logo)
      const post = await User.findOneAndUpdate({ _id: userId }, {
        [type]: imageName // Динамическое обновление
      }, { new: true });

      if (!post) {
        throw new Error("Пользователь не найден");
      }
      res.json(post);
  } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: "Ошибка при обновлении изображения" });
  }
});


app.post('/uploadArticlePhoto/:id', upload.single('image'), async (req, res) => {
  const articleId = req.params.id;

  try {
    // Проверяем, является ли ID валидным ObjectId
    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      return res.status(400).json({ error: 'Некорректный формат ID' });
    }

    // Находим запись в базе
    const oldUser = await Journal.findOne({ _id: articleId });

    // Если запись существует, проверяем и удаляем старое изображение
    if (oldUser) {
      const oldImage = oldUser.img;
      if (oldImage && oldImage.length >= 1) {
        const commandDelete = new DeleteObjectCommand({
          Bucket: bucketName,
          Key: oldImage,
        });
        await s3.send(commandDelete);
      }
    }

    // Загружаем новое изображение
    const buffer = await sharp(req.file.buffer).toBuffer();
    const imageName = randomImageName();

    const params = {
      Bucket: bucketName,
      Key: imageName,
      Body: buffer,
      ContentType: req.file.mimetype,
    };

    const command = new PutObjectCommand(params);
    await s3.send(command);

    // Обновляем запись или создаем новую
    const post = await Journal.findOneAndUpdate(
      { _id: articleId },
      { img: imageName },
      { new: true, upsert: true } // upsert создаёт запись, если её нет
    );

    res.json(post);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: 'Ошибка при обновлении изображения' });
  }
});


const uploadFileToS3 = (file) => {
  const uniqueFileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}-${file.originalname}`;
  const imageName = randomImageName();

  const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: imageName, // Генерируем уникальное имя для файла
      Body: file.buffer,
      ContentType: file.mimetype,
  };

  return s3.upload(params).promise();
};

app.post('/deleteImageFromPortfolio', async (req, res) => {
  try {
    const idx = req.body.idx;
    const id = req.body.userId;

    if (idx !== undefined && id) {
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      // Проверка, что индекс находится в пределах массива
      if (idx >= 0 && idx < user.portfolio.length) {
        // Удаляем элемент по индексу
        user.portfolio.splice(idx, 1);

        // Сохраняем изменения
        await user.save();

        return res.status(200).json({ message: "Изображение успешно удалено" });
      } else {
        return res.status(400).json({ message: "Неверный индекс" });
      }
    } else {
      return res.status(400).json({ message: "Некорректные данные" });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Ошибка сервера" });
  }
});


app.post('/auth/updateInfo', upload.array('portfolio', 50), async (req, res) => {
  try {
      const id = req.body.userId; // Получаем userId из тела запроса

      // Извлекаем текущие данные пользователя
      const user = await User.findById(id);
      if (!user) {
          return res.status(404).json({ message: "Пользователь не найден" });
      }

      // Собираем обновляемые поля
      const updateFields = {
          company: req.body.company,
          name: req.body.name,
          nomination: req.body.nomination,
          job: req.body.job,
          about: req.body.about,
          phone: req.body.phone,
          sait: req.body.sait,
          city: req.body.city,
          specialization: req.body.specialization
      };

      // Получаем файлы из запроса
      const files = req.files ? req.files.flat() : []; // Проверяем, есть ли файлы


      // Если файлы есть, добавляем их к существующему портфолио
      if (files.length > 0) {
          const uploadedPortfolio = [];

          // Загружаем новые файлы в S3 и сохраняем их имена
          for (let file of files) {
              const buffer = await sharp(file.buffer).toBuffer(); // Обрабатываем изображение с помощью sharp
              const imageName = randomImageName();

              const params = {
                  Bucket: bucketName,
                  Key: imageName, // Ключ для файла в S3
                  Body: buffer,
                  ContentType: file.mimetype,
              };

              const command = new PutObjectCommand(params);
              await s3.send(command); // Загружаем файл в S3

              uploadedPortfolio.push(imageName); // Добавляем имя загруженного файла в массив
          }
          

          // Добавляем новые файлы к существующему портфолио
          const currentPortfolio = user.portfolio || []; // Получаем текущее портфолио
          updateFields.portfolio = [...currentPortfolio, ...uploadedPortfolio]; // Добавляем новые файлы
      }

      // Обновляем информацию о пользователе
      const updatedUser = await User.findOneAndUpdate(
          { _id: id },
          updateFields,
          { new: true }
      );

      if (!updatedUser) {
          return res.status(404).json({ message: "Пользователь не найден" });
      }

      res.json({ message: 'Информация успешно обновлена', user: updatedUser });
  } catch (error) {
      console.error('Ошибка обновления информации:', error);
      res.status(500).json({ message: 'Ошибка обновления информации' });
  }
});





app.post('/auth/updateSocialInfo', UserController.updateSocialInfo)




app.get('/getDeadline', DeadlineController.getDeadline);
app.post('/setDeadline', DeadlineController.setDeadline);



app.get('/article', ArticleController.getAll);
app.post('/article',  ArticleController.create);
app.delete('/article/:name', checkAdmin, ArticleController.remove);
app.patch('/article/update/:title', checkAdmin, ArticleController.updateInfo);


app.get('/nom', NominationController.getAll);
app.post('/nom',  NominationController.create);
app.delete('/nom/:id', NominationController.remove);
app.patch('/nom/update/:id', NominationController.updateInfo);
app.post('/nom/modify/:id', NominationController.modifyNomination);
app.post('/loginAdmin', UserController.loginAdmin)
app.post('/loginJoury', UserController.loginJoury)
app.post('/setJouryNomination', UserController.setJouryNomination)

app.post('/setJoury', UserController.setJoury)
app.post('/setJouryStatus', UserController.setJouryStatus)


app.post('/addCriterion', NominationController.addCriterion)
app.post('/editCriterion', NominationController.editCriterion)
app.post('/deleteCriterion', NominationController.deleteCriterion)
app.post('/users/jury-ratings', UserController.saveJuryRating);
app.get('/users/:userId/jury-ratings', UserController.getJuryRatings);


app.post('/createJournal', JournalController.createJournal)
app.get('/getJournal', JournalController.getLatestJournal)
app.get('/getJournals', async(req, res) => {
  try {
    // Находим самую свежую запись, отсортированную по дате создания
    const id = req.params.id;
    const latestFaq = await Journal.find();

    if (!latestFaq) {
      return res.status(404).json({ message: "FAQ не найден." });
    }

    for(let i = 0; i < latestFaq.length; i++){
      if(latestFaq[i].img && latestFaq[i].img.length >= 1){
        const img = await getSignedUrlForKey(latestFaq[i].img);
        latestFaq[i].img = img
      }
    }

    res.status(200).json(latestFaq);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Произошла ошибка при получении FAQ" });   
}
}
)

app.get('/getJournalById/:id', async(req, res) => {
  try {
    // Находим самую свежую запись, отсортированную по дате создания
    const id = req.params.id;
    const latestFaq = await Journal.findOne({_id: id});

    if (!latestFaq) {
      return res.status(404).json({ message: "FAQ не найден." });
    }

    if(latestFaq.img && latestFaq.img.length >= 1){
      const img = await getSignedUrlForKey(latestFaq.img);
      latestFaq.img = img
    }

    res.status(200).json(latestFaq);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Произошла ошибка при получении FAQ" });   
}
}
)

app.post('/updateJournal', JournalController.updateJournal)
app.post('/deleteJournal', JournalController.deleteJournal)


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

app.post('/favorites/addFavorite', UserController.addToFavorites)
app.post('/favorites/removeFavorite', UserController.removeFromFavorites)

app.post('/uploadImage', upload.single('image'), (req, res) => {
  try {
      if (!req.file) {
          return res.status(400).json({ success: false, message: 'No file uploaded!' });
      }

      // URL загруженного файла
      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

      res.json({
          success: true,
          fileUrl,
      });
  } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Server error!' });
  }
});


app.post('/updateBalance', UserController.updateUserBalance)

// Раздача статических файлов (загруженные изображения)
app.use('/uploads', express.static(uploadDir));





const port = process.env.PORT || 3001

app.listen(port, function(){
    console.log(successMsg("listening port:", port));
  });



