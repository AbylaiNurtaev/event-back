import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import UserModel from './../models/User.js';

import nodemailer from 'nodemailer'
import bcrypt from 'bcrypt'
import UserOTPVerification from '../models/UserOTPVerification.js';

export const register = async (req, res) => {
    try {
        const password = req.body.password;
        const hash = await argon2.hash(password);

        const doc = new UserModel({
            email: req.body.email,
            passwordHash: hash,
            role: req.body.role,
            verified: false
        });

        const user = await doc.save().then((result) => {
            sendOTPVerificationEmail(result);
            console.log(result)
            return result;
        });

        const token = jwt.sign({
            _id: user._id
        }, 'secret123', {
            expiresIn: "30d",
        });

        const { passwordHash, ...userData } = user._doc;
        res.json({
            ...userData,
            token,
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: "Не удалось зарегистрироваться",
        });
    }
}

const transporter = nodemailer.createTransport({
    host: 'smtppro.zoho.in',
    secure: false,
    port: 587,
    auth: {
      user: "weds.astana@gmail.com",
      pass: "eYV6qZHGzmVt",
    },
  });

const sendOTPVerificationEmail = async ({_id, email}) => {
    try {
        const otp = `${1000 + Math.random * 9000} `;

        const mailOptions = {
            from: "krutyev5@gmail.com",
            to: email,
            subject: "Verify Your Email",
            html: `<p>Ваш код верификации: ${otp}</p>`
        }

        const saltRounds = 10;
        
        const hashedOTP = await bcrypt.hash(otp, saltRounds)
        const newOtpVerification = await new UserOTPVerification({
            userId: _id,
            otp: hashedOTP,
            createdAt: Date.now(),
            expiresAt: Date.now() + 3600000
        })
        await newOtpVerification.save()
        await transporter.sendMail(mailOptions)
        // res.json({
        //     status: "PENDING",
        //     message: "На вашу почту отправлен код подтверждения",
        //     data: {
        //         userId: _id,
        //         email
        //     }
        // })
        

    } catch (error) {
        throw new Error(error.message);
    }
}


export const login = async (req, res) => {
    try {
        const user = await UserModel.findOne({ email: req.body.email });

        if (!user) {
            return res.status(404).json({
                message: "Пользователь не найден"
            });
        }

        const isValidPass = await argon2.verify(user._doc.passwordHash, req.body.password);

        if (!isValidPass) {
            return res.status(400).json({
                message: "Неверный логин или пароль"
            });
        }

        const token = jwt.sign({
            _id: user._id,
        }, 'secret123', {
            expiresIn: "30d",
        });

        const { passwordHash, ...userData } = user._doc;
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
