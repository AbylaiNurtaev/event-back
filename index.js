import express from 'express';
import mongoose from 'mongoose';
import chalk from 'chalk';
import handleValidationErrors from './utils/handleValidationErrors.js';
import dotenv from 'dotenv';
import multer from 'multer';
dotenv.config();
import crypto from 'crypto'

import sharp from 'sharp';

import cors from 'cors'
import * as UserController from './controllers/UserController.js'
import jwt from 'jsonwebtoken'

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import checkAuth from './utils/checkAuth.js';
import { ArticleController } from './controllers/index.js';
import checkAdmin from './utils/checkAdmin.js';

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import User from './models/User.js';

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


// mongoose.connect(process.env.MONGODB_URI)
mongoose.connect('mongodb+srv://wedsastana:20060903@cluster0.h2di1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')

.then(() => console.log(successMsg("DB ok")))
.catch((err) => console.log(errorMsg("DB error:", err)))

const app = express();

app.use(cors())
app.use(express.json());

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })


app.post('/api/uploadPortfolio/:id', upload.array('images', 50), async (req, res) => {
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
      { $set: { "applications.$.application_data": uploadedImages } }, // Обновление, если есть такой application_id
      { new: true }
    );
    
    if (!user) {
      // Если заявки с таким application_id нет, создаём новую заявку
      user = await User.findOneAndUpdate(
        { _id: id },
        { $push: { applications: { application_id: application_id, portfolio: uploadedImages } } }, // Пушим новый объект заявки
        { new: true }
      );
    }
    res.json({ message: 'Фотографии успешно загружены', images: uploadedImages });
  } catch (error) {
    console.error('Ошибка загрузки фотографий:', error);
    res.status(500).json({ message: 'Ошибка загрузки фотографий' });
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
      { $set: { "applications.$.previews": uploadedImages } }, // Обновление, если есть такой application_id
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





app.post('/createApplication', async (req, res) => {
  const application_id = req.body.application_id
  const id = req.body.id
  try {
    let user = await User.findOneAndUpdate(
      { _id: id, "applications.application_id": application_id },
      { $set: { "applications.$.application_data": req.body.application } }, // Обновление, если есть такой application_id
      { new: true }
    );
    
    if (!user) {
      // Если заявки с таким application_id нет, создаём новую заявку
      user = await User.findOneAndUpdate(
        { _id: id },
        { $push: { applications: { application_id: application_id, application: req.body.application } } }, // Пушим новый объект заявки
        { new: true }
      );
    }
    

    res.json(user); // Отправляем обновленного пользователя в ответе
  } catch (error) {
    console.error('Ошибка при добавлении заявки:', error);
    res.status(500).json({ message: 'Ошибка при добавлении заявки' });
  }
});


app.post('/auth/getUser', async (req, res) => {
  try {
      const user = await User.findOne({ _id: req.body.userId });
      const type = req.body.type; // Получаем тип (avatar, logo, portfolio)

      if (!user) {
        return res.json({ message: "Пользователь не найден" });
      }

      if (!['avatar', 'logo', 'portfolio'].includes(type)) {
        return res.status(400).json({ message: "Invalid type" });
      }

      // Если запрашиваем портфолио
      if (type === 'portfolio') {
        if (!user.portfolio || user.portfolio.length === 0) {
          return res.status(404).json({ message: "Портфолио не найдено" });
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
      } else {
        // Генерация ссылки для avatar или logo
        const key = user[type]; // Динамически получаем поле avatar или logo

        if (!key) {
          return res.status(404).json({ message: `Поле ${type} не найдено` });
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



app.post('/auth/updateInfo', UserController.updateInfo)
app.post('/auth/updateSocialInfo', UserController.updateSocialInfo)


app.get('/article', ArticleController.getAll);
app.post('/article',  ArticleController.create);
app.delete('/article/:name', checkAdmin, ArticleController.remove);
app.patch('/article/update/:title', checkAdmin, ArticleController.updateInfo);

app.post('/loginAdmin', UserController.loginAdmin)
app.post('/loginJoury', UserController.loginJoury)




const port = process.env.PORT || 3001

app.listen(port, function(){
    console.log(successMsg("listening port:", port));
  });



