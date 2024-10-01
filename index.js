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
import * as NominationController from './controllers/NominationController.js'
import * as DeadlineController from './controllers/DeadlineController.js'
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

app.use(cors({
  origin: '*', // Укажите домен вашего фронтенда
  methods: ['GET','PATCH', 'POST', 'PUT', 'DELETE'],
  credentials: true, // Если нужны куки или авторизация
}));


app.use(express.json());

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })


app.post('/api/uploadPortfolio/:id', upload.array('images', 50), async (req, res) => {
  try {
    const id = req.params.id;
    const application_id = req.body.application_id;

    // Flatten the array of arrays into a single array
    const files = req.files.flat();
    const uploadedImages = [];

    for (let file of files) {
      const buffer = await sharp(file.buffer).toBuffer(); // Process the image using sharp
      const imageName = randomImageName(); // Generate a unique name for the image

      const params = {
        Bucket: bucketName,
        Key: imageName,
        Body: buffer,
        ContentType: file.mimetype
      };

      const command = new PutObjectCommand(params);
      await s3.send(command);

      uploadedImages.push(imageName); // Add the image name to the array of uploaded images
    }

    // Update the existing application data with the new images
    let user = await User.findOneAndUpdate(
      { _id: id, "applications.application_id": application_id },
      { $set: { "applications.$.application_data": uploadedImages } }, // Update if the application_id exists
      { new: true }
    );

    if (!user) {
      // If the application with such application_id does not exist, create a new one
      user = await User.findOneAndUpdate(
        { _id: id },
        { $push: { applications: { application_id: application_id, portfolio: uploadedImages } } }, // Push a new application object
        { new: true }
      );
    }

    res.json({ message: 'Фотографии успешно загружены', images: uploadedImages });
  } catch (error) {
    console.error('Ошибка загрузки фотографий:', error);
    res.status(500).json({ message: 'Ошибка загрузки фотографий' });
  }
});


app.post('/api/uploadDocuments/:id', upload.array('documents', 50), async (req, res) => {
  try {
    const id = req.params.id;
    const application_id = req.body.application_id;
    
    const files = req.files; // Получаем массив файлов
    const uploadedDocuments = [];

    for (let file of files) {
      const documentName = randomImageName(); // Генерируем имя для документа

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

    let user = await User.findOneAndUpdate(
      { _id: id, "applications.application_id": application_id },
      { $set: { "applications.$.documents": uploadedDocuments } }, // Обновление, если есть такой application_id
      { new: true }
    );
    
    if (!user) {
      // Если заявки с таким application_id нет, создаём новую заявку
      user = await User.findOneAndUpdate(
        { _id: id },
        { $push: { applications: { application_id: application_id, documents: uploadedDocuments } } }, // Пушим новый объект заявки
        { new: true }
      );
    }
    
    res.json({ message: 'Документы успешно загружены', documents: uploadedDocuments });
  } catch (error) {
    console.error('Ошибка загрузки документов:', error);
    res.status(500).json({ message: 'Ошибка загрузки документов' });
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


app.get('/getJouries', UserController.getJouries)
app.post('/deleteJoury', UserController.deleteJoury)


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


app.post('/updateApplication', async (req, res) => {
  const application_id = req.body.application_id;
  const id = req.body.id;

  try {
    // Найти пользователя и обновить заявку с указанным application_id
    const user = await User.findOneAndUpdate(
      { _id: id, "applications.application_id": application_id },
      { $set: { "applications.$.application_data": req.body.application } }, // Обновление заявки
      { new: true }
    );

    if (user) {
      res.json({ user, message: "Заявка успешно обновлена" });
    } else {
      res.status(404).json({ message: "Заявка или пользователь не найдены" });
    }
  } catch (error) {
    console.error('Ошибка при обновлении заявки:', error);
    res.status(500).json({ message: 'Ошибка при обновлении заявки' });
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
    console.log(application)

    if (!application) {
      return res.status(404).json({ message: "Заявка не найдена" });
    }

    // Создаем пустой объект для хранения всех ссылок
    const allInfo = {};
    // Конвертируем portfolio
    if (application.portfolio && application.portfolio.length > 0) {
      const portfolioUrls = await Promise.all(application.portfolio.map(async (key) => {
        const url = await getSignedUrlForKey(key);
        return url;
      }));
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

app.post('/auth/updateInfo', upload.array('portfolio', 50), async (req, res) => {
  try {
      const id = req.body.userId; // Получаем userId из тела запроса
      const updateFields = {
          company: req.body.company,
          name: req.body.name,
          nomination: req.body.nomination,
          job: req.body.job,
          about: req.body.about,
          phone: req.body.phone,
          sait: req.body.sait,
          city: req.body.city,
      };

      // Flatten the array of arrays into a single array
      const files = req.files ? req.files.flat() : []; // Проверяем, есть ли файлы

      if (files.length > 0) {
          const uploadedPortfolio = [];

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
          console.log('priletelo',uploadedPortfolio)

          // Добавляем URL портфолио в обновляемые поля
          updateFields.portfolio = uploadedPortfolio;
      }

      // Обновляем информацию о пользователе
      const user = await User.findOneAndUpdate(
          { _id: id },
          updateFields,
          { new: true }
      );

      if (!user) {
          return res.status(404).json({ message: "Пользователь не найден" });
      }

      res.json({ message: 'Информация успешно обновлена', user });
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


const port = process.env.PORT || 3001

app.listen(port, function(){
    console.log(successMsg("listening port:", port));
  });



