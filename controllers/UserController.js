import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import UserModel from './../models/User.js';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer'
import bcrypt from 'bcrypt'
import UserOTPVerification from '../models/UserOTPVerification.js';

dotenv.config();
import crypto from 'crypto';
import Mailgen from 'mailgen';
import User from './../models/User.js';

export const updateInfo = async(req, res) => {
    try {
        const user = await User.findOneAndUpdate({ _id: req.body.userId },
            {
                // email: req.body.email,
                company: req.body.company,
                name: req.body.name,
                // photo: req.body.photo,
                nomination: req.body.nomination,
                job: req.body.job,
                about: req.body.about,
            },
            { new: true }
        )
        if(!user){
            throw new Error("Пользователь не найден")
        }
        res.json(user)
    } catch (error) {
        console.log(error.message)
    }
}

export const updateSocialInfo = async(req, res) => {
    try {
        const user = await User.findOneAndUpdate({ _id: req.body.userId },
            {
                // email: req.body.email,
                instagram: req.body.instagram,
                vk: req.body.vk,
                // photo: req.body.photo,
                tiktok: req.body.tiktok,
                youtube: req.body.youtube,
            },
            { new: true }
        )
        if(!user){
            throw new Error("Пользователь не найден")
        }
        res.json(user)
    } catch (error) {
        console.log(error.message)
    }
}

export const register = async (req, res) => {
    try {
      const existUser = await User.findOne({ email: req.body.email });
      if (existUser) {
        await sendOTPVerificationEmail({ _id: existUser._id, email: req.body.email });
        const token = jwt.sign({ _id: existUser._id }, 'secret123', { expiresIn: '30d' });
  
        res.json({ token, ...existUser._doc });
      } else {
        const newUser = new User({
          email: req.body.email,
          role: req.body.role,
          verified: false,
        });
  
        const savedUser = await newUser.save();
        await sendOTPVerificationEmail({ _id: savedUser._id, email: req.body.email });
  
        const token = jwt.sign({ _id: savedUser._id }, 'secret123', { expiresIn: '30d' });
  
        res.json({ token, ...savedUser._doc });
      }
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: 'Не удалось зарегистрироваться' });
    }
  };
  

const auth = {
    user: process.env.USER,
    pass: process.env.PASS
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: auth.user,
      pass: auth.pass,
    },
    secure: true, // Используем безопасное соединение
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
  

  const sendOTPVerificationEmail = async ({ _id, email }) => {
    try {
      // Генерация случайного OTP
      const otp = crypto.randomInt(1000, 9999).toString(); // Криптографически стойкий генератор случайных чисел
      console.log(otp); // Вывод для отладки
  
      // Настройка письма
      const mailOptions = {
        from: auth.user, // используем email, указанный в auth
        to: email, // email получателя
        subject: 'Verify Your Email',
        html: `<p>Ваш код верификации: ${otp}</p>`,
      };
  
      // Хешируем OTP перед сохранением в базу данных
      const saltRounds = 10;
      const hashedOTP = await bcrypt.hash(otp, saltRounds);
  
      // Сохраняем OTP в базе данных
      const newOtpVerification = new UserOTPVerification({
        userId: _id,
        otp: hashedOTP,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000, // 1 час
      });
  
      await newOtpVerification.save();
  
      // Проверяем соединение перед отправкой
      await verifyTransporter();
  
      // Отправляем email с OTP
      await transporter.sendMail(mailOptions);
      console.log('Email отправлен успешно');
    } catch (error) {
      console.error('Ошибка при отправке email:', error.message);
      throw new Error(error.message);
    }
  };
  


export const verifyOTP = async (req, res) => {
    try {
        let { userId, otp } = req.body;

        if (!userId || !otp) {
            throw new Error("Empty otp details are not allowed");
        }

        const UserOTPVerificationRecords = await UserOTPVerification.find({ userId });
        
        if (UserOTPVerificationRecords.length <= 0) {
            throw new Error("Account record doesn't exist");
        }

        const { expiresAt, otp: hashedOTP, realOtp } = UserOTPVerificationRecords[0];

        if (expiresAt < Date.now()) {
            await UserOTPVerification.deleteMany({ userId });
            throw new Error("Код устарел, попробуйте ещё раз.");
        }

        const validOTP = await bcrypt.compare(otp, hashedOTP);
        console.log("valid",validOTP, "real otp", otp, realOtp)
        // console.log(otp, )

        if (!validOTP) {
            throw new Error("Неверный код. Проверьте свою почту!");
        }

        const user = await User.findOne({ _id: userId });

        await UserOTPVerification.deleteMany({ userId });

        res.json({
            status: "VERIFIED",
            message: user.name ? "exist" : "new",
        });
    } catch (error) {
        console.log(error.message)
    }
};


export const resendOTP = async (req, res) => {
    try {
        let { userId, email } = req.body;

        if (!userId || !email) {
            throw new Error("Не получилось найти такой email");
        }

        // Удаляем старые записи перед созданием нового OTP
        await UserOTPVerification.deleteMany({ userId });

        // Генерируем и отправляем новый код
        await sendOTPVerificationEmail({ _id: userId, email });

        res.json({
            status: "PENDING",
            message: "Письмо отправлено на вашу почту"
        });
    } catch (error) {
        res.json({
            status: "FAILED",
            message: error.message
        });
    }
};





export const getUserByToken = async (req, res) => {
    try {
        const token = (req.headers.authorization || '').replace(/Bearer\s?/, '');
        const decoded = jwt.verify(token, 'secret123')

        const user = await User.findOne({ _id: decoded._id });        

        if (!user) {
            return res.json({
                message: "Пользователь не найден"
            });
        }


        const { ...userData } = user._doc;
        res.json({
            ...userData,
            token,
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: "Не удалось авторизоваться"
        });
    }
}


export const loginAdmin = async (req, res) => {
    const id = req.body.id;
    const user = await User.findOne({ _id: id })

    if(user && user.role == "admin"){
        res.json("success")
    }else{
        return res.status(500).json({
            message: "Не получилось авторизоваться",
        });
    }
}


export const loginJoury = async (req, res) => {
    const id = req.body.id;
    const user = await User.findOne({ _id: id })

    if(user && user.role == "joury"){
        res.json("success")
    }else{
        return res.status(500).json({
            message: "Не получилось авторизоваться",
        });
    }
}

