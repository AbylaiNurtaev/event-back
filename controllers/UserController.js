import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import Mailgen from 'mailgen';
import UserModel from './../models/User.js';
import UserOTPVerification from '../models/UserOTPVerification.js';
import User from './../models/User.js';

// Обновление основной информации о пользователе
export const updateInfo = async (req, res) => {
    try {
        const user = await User.findOneAndUpdate(
            { _id: req.body.userId },
            {
                company: req.body.company,
                name: req.body.name,
                nomination: req.body.nomination,
                job: req.body.job,
                about: req.body.about,
            },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ message: "Пользователь не найден" });
        }

        res.json(user);
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: "Ошибка при обновлении информации" });
    }
};

// Обновление информации о социальных сетях
export const updateSocialInfo = async (req, res) => {
    try {
        const user = await User.findOneAndUpdate(
            { _id: req.body.userId },
            {
                instagram: req.body.instagram,
                vk: req.body.vk,
                tiktok: req.body.tiktok,
                youtube: req.body.youtube,
            },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ message: "Пользователь не найден" });
        }

        res.json(user);
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: "Ошибка при обновлении социальной информации" });
    }
};

// Регистрация пользователя
export const register = async (req, res) => {
    try {
        const existUser = await UserModel.findOne({ email: req.body.email });

        if (existUser) {
            sendOTPVerificationEmail({ _id: existUser._id, email: req.body.email });
            const token = jwt.sign({ _id: existUser._id }, 'secret123', { expiresIn: "30d" });

            const { ...userData } = existUser._doc;
            return res.json({ ...userData, token });
        }

        const doc = new UserModel({
            email: req.body.email,
            role: req.body.role,
            verified: false
        });

        const user = await doc.save();
        sendOTPVerificationEmail({ _id: user._id, email: user.email });

        const token = jwt.sign({ _id: user._id }, 'secret123', { expiresIn: "30d" });
        const { passwordHash, ...userData } = user._doc;

        res.json({ ...userData, token });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Не удалось зарегистрироваться" });
    }
};

// Настройка отправки почты
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "weds.astana@gmail.com",
        pass: "ufok hbei qkso egod",
    },
});

// Отправка кода верификации
const sendOTPVerificationEmail = async ({ _id, email }) => {
    try {
        const otp = `${Math.floor(1000 + Math.random() * 9000)}`;
        const mailOptions = {
            from: "weds.astana@gmail.com",
            to: email,
            subject: "Verify Your Email",
            html: `<p>Ваш код верификации: ${otp}</p>`,
        };

        const hashedOTP = await bcrypt.hash(otp, 10);
        const newOtpVerification = new UserOTPVerification({
            userId: _id,
            otp: hashedOTP,
            createdAt: Date.now(),
            expiresAt: Date.now() + 3600000, // 1 час
        });

        await newOtpVerification.save();
        await transporter.sendMail(mailOptions);

    } catch (error) {
        throw new Error(error.message);
    }
};

// Верификация OTP
export const verifyOTP = async (req, res) => {
    try {
        const { userId, otp } = req.body;

        if (!userId || !otp) {
            return res.status(400).json({ message: "Пустые данные не допускаются" });
        }

        const userOTPRecords = await UserOTPVerification.find({ userId });
        if (userOTPRecords.length <= 0) {
            return res.status(404).json({ message: "Запись не найдена" });
        }

        const { expiresAt, otp: hashedOTP } = userOTPRecords[0];
        if (expiresAt < Date.now()) {
            await UserOTPVerification.deleteMany({ userId });
            return res.status(400).json({ message: "Код устарел, попробуйте ещё раз" });
        }

        const validOTP = await bcrypt.compare(otp, hashedOTP);
        if (!validOTP) {
            return res.status(400).json({ message: "Неверный код" });
        }

        const user = await User.findOne({ _id: userId });
        await UserOTPVerification.deleteMany({ userId });

        res.json({ status: "VERIFIED", message: user.name ? "exist" : "new" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Повторная отправка OTP
export const resendOTP = async (req, res) => {
    try {
        const { userId, email } = req.body;

        if (!userId || !email) {
            return res.status(400).json({ message: "Данные не найдены" });
        }

        await UserOTPVerification.deleteMany({ userId });
        await sendOTPVerificationEmail({ _id: userId, email });

        res.json({ status: "PENDING", message: "Письмо отправлено" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Получение пользователя по токену
export const getUserByToken = async (req, res) => {
    try {
        const token = (req.headers.authorization || '').replace(/Bearer\s?/, '');
        const decoded = jwt.verify(token, 'secret123');

        const user = await User.findOne({ _id: decoded._id });
        if (!user) {
            return res.status(404).json({ message: "Пользователь не найден" });
        }

        const { ...userData } = user._doc;
        res.json({ ...userData, token });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Не удалось авторизоваться" });
    }
};

// Авторизация админа
export const loginAdmin = async (req, res) => {
    try {
        const { id } = req.body;
        const user = await User.findOne({ _id: id });

        if (user && user.role === "admin") {
            res.json("success");
        } else {
            res.status(403).json({ message: "Не удалось авторизоваться" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Авторизация жюри
export const loginJoury = async (req, res) => {
    try {
        const { id } = req.body;
        const user = await User.findOne({ _id: id });

        if (user && user.role === "joury") {
            res.json("success");
        } else {
            res.status(403).json({ message: "Не удалось авторизоваться" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
