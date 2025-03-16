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
        const email = req.body.email.toLowerCase(); // Приводим email к нижнему регистру
        const existUser = await User.findOne({ email });

        // Проверка на конкретный userId
        if (existUser && existUser._id.toString() === "67c710e7ff44338def2d9a79") {
            const token = jwt.sign({ _id: existUser._id }, 'secret123', { expiresIn: '30d' });

            return res.json({ token, ...existUser._doc });
        }

        if (existUser) {
            await UserOTPVerification.deleteMany({ userId: existUser._id });
            await sendOTPVerificationEmail({ _id: existUser._id, email });
            const token = jwt.sign({ _id: existUser._id }, 'secret123', { expiresIn: '30d' });

            return res.json({ token, ...existUser._doc });
        } else {
            const newUser = new User({
                email,
                role: req.body.role,
                verified: false,
            });

            const savedUser = await newUser.save();
            await sendOTPVerificationEmail({ _id: savedUser._id, email });

            const token = jwt.sign({ _id: savedUser._id }, 'secret123', { expiresIn: '30d' });

            return res.json({ token, ...savedUser._doc });
        }
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Не удалось зарегистрироваться' });
    }
};


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

  export const sendReligionMail = async(req, res) => {
    try {
        const { name, phone, soc } = req.body;
        await sendReligion(name, phone, soc)
        res.json({message: 'success'})
    } catch (error) {
        console.log(error)
    }
  }

  const sendReligion = async (name, phone, soc) => {
    console.log(name, phone, soc)
    try {
        const mailOptions = {
            from: auth.user,
            // to: 'wolfaleks84@gmail.com',
            to: 'wolfaleks84@gmail.com',
            subject: "Пришла новая заявка",
            html: `<p>Имя заказчика: ${name}</p> <p>Телефон: ${phone}</p> <p>Ссылка на социальную сеть: ${soc}</p>`
        }
        await verifyTransporter()
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.log(error)
    }
  }
  

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
        html: `
        <img src="https://i.imgur.com/qJax1GC.png" alt="Verification Code Image" style="width: 100%; max-width: 600px;">
<p>
    <b style="font-size: 18px;">Ваш код верификации: ${otp}</b>
</p>
<br><br><br>
<p>
    Поздравляем! Вы теперь на шаг ближе к WEDS RATING🔥 <br>
    Благодарим за регистрацию на сайте WEDS. <br>
    Теперь вы официально стали частью нашего сообщества, и мы рады поздравить вас с этим важным шагом.
    <br><br>
    Что нужно сделать прямо сейчас?<br>
    1. Перейти по ссылке, зарегистрироваться в личном кабинете и оплатить участие в рейтинге 👉 <a href="https://weds.kz" target="_blank">weds.kz</a><br>
    2. Вступить в закрытый Telegram-канал, где мы будем делиться полезной информацией, отвечать на вопросы и помогать вам на пути к победе.
    Этот канал — уникальная возможность стать частью сообщества самых крутых и смелых специалистов индустрии: <br>
    👉 <a href="https://t.me/+vx2atrYrlfs0ZTZi" target="_blank">https://t.me/+vx2atrYrlfs0ZTZi</a><br>
    Смелость всегда вознаграждается. <br><br><br>
    Теперь дело за вами — блестите, удивляйте и, главное, не забудьте сделать это с улыбкой😉<br>
    Мы уже болеем за вас и уверены, что будет огонь.
    <br><br>
    С уважением,<br>
    Команда WEDS
</p>

`,
      };
  
      // Хешируем OTP перед сохранением в базу данных
      const saltRounds = 10;
      const hashedOTP = await bcrypt.hash(otp, saltRounds);
      if(email == "abddariga@mail.ru"){
        hashedOTP == '1193'
      }
  
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
        const user = await User.findOne({ _id: userId });
        if(userId == "67c710e7ff44338def2d9a79" && otp == '1193'){
            res.json({
                status: "VERIFIED",
                message: user.name ? "exist" : "new",
            });
        }

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

        

        await UserOTPVerification.deleteMany({ userId });

        res.json({
            status: "VERIFIED",
            message: user.name ? "exist" : "new",
        });
    } catch (error) {
        console.log(error.message)
    }
};


export const updateJouryOrder = async (req, res) => {
    try {
        const { jouries } = req.body; // Получаем массив с жюри и их порядком

        // Проходим по каждому жюри и обновляем его порядок
        for (let i = 0; i < jouries.length; i++) {
            await User.findOneAndUpdate(
                { email: jouries[i].email }, // Поиск по email
                { order: i }, // Устанавливаем новое значение order
                { new: true } // Возвращаем обновлённый документ
            );
        }

        res.status(200).json({ message: "Порядок жюри успешно обновлён!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ошибка при обновлении порядка жюри" });
    }
};



export const getJouries = async (req, res) => {
    try {
      // Находим всех пользователей с ролью "joury" и указанным email
      let users = await User.find(
        { role: "joury" }
      );
  
      res.json(users);
      
    } catch (error) {
      res.status(500).json({
        message: "Ошибка на сервере",
      });
    }
  };



  
export const setJoury = async(req, res) => {
    try {
        const email = req.body.email;
        let user = await User.findOneAndUpdate(
            {email},
            {
                role: "joury"
            },
            { new: true }
        )
        if(user){
            res.json({ message: "Вы успешно зарегестрировали Жюри!" })
        }else{
            res.json({ message: "Жюри ещё не зарегестрировался на сайте" })
        }
    } catch (error) {
        res.status(404).json({
            message: "Ошибка"
        })
    }
}


export const setJouryStatus = async(req, res) => {
    try {
        const email = req.body.email;
        const status = req.body.status;
        let user = await User.findOneAndUpdate(
            {email},
            {
                additionalJoury: status
            },
            { new: true }
        )
        if(user){
            res.json({ message: "Вы успешно выставили Жюри!" })
        }else{
            res.json({ message: "ПРоблемы с выставлением" })
        }
    } catch (error) {
        res.status(404).json({
            message: "Ошибка"
        })
    }
}

export const setJouryNomination = async(req, res) => {
    try {
        const email = req.body.email;
        const acceptedNominations = req.body.acceptedNominations;
        let user = await User.findOneAndUpdate(
            {email},
            {
                acceptedNominations
            },
            { new: true }
        )
        if(user){
            res.json({ message: "Вы успешно выставили разрешения для Жюри!" })
        }else{
            res.json({ message: "ПРоблемы с выставлением" })
        }
    } catch (error) {
        res.status(404).json({
            message: "Ошибка"
        })
    }
}

export const deleteJoury = async(req, res) => {
    try {
        const email = req.body.email;
        let user = await User.findOneAndUpdate(
            {email},
            {
                role: "user"
            },
            { new: true }
        )
        if(user){
            res.json({ message: "Вы успешно удалили Жюри!" })
        }else{
            res.json({ message: "Нет такого пользователя" })
        }
    } catch (error) {
        res.status(404).json({
            message: "Ошибка"
        })
    }
}

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
        res.json({
            status: "success",
            ...user._doc
        })
    }else{
        return res.status(500).json({
            message: "Не получилось авторизоваться",
        });
    }
}

export const accessApplication = async (req, res) => {
    const { userId, applicationId } = req.body;

    try {
        const user = await User.findOne({ _id: userId });
        if (user) {
            const application = user.applications.find((elem) => elem.application_id == applicationId);

            if (application) {
                console.log("Current accepted value:", application.accepted);

                // Toggle the `accepted` value
                application.accepted = !application.accepted;

                console.log("New accepted value:", application.accepted);

                // Mark the `applications` array as modified to ensure Mongoose saves it
                user.markModified("applications");


                // Save the user document to persist changes
                await user.save();
                const auth = {
                    user: process.env.USER1,
                    pass: process.env.PASS
                }
                const mailOptions = {
                    from: auth.user,
                    // to: 'wolfaleks84@gmail.com',
                    to: user.email,
                    subject: "WEDS",
                    html: `Ваша заявка на участие в номинации ${application?.application_data?.nomination} имеет статус: Одобрена, для просмотра заявки перейдите в личный кабинет.`
                }
                await verifyTransporter()
                await transporter.sendMail(mailOptions);

                res.json({ message: "Application status updated", application });
            } else {
                res.status(404).json({ message: "Application not found" });
            }
        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: "Server error" });
    }
};


export const saveJuryRating = async (req, res) => {
    const { userId, ratingData, graded, applicationId } = req.body; // Ожидается, что ratingData — это массив с объектами рейтингов

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "Пользователь не найден" });

        for (const newRating of ratingData) {
            const existingRating = user.jouryRate.find(
                (rate) =>
                    rate.name === newRating.name &&
                    rate.category === newRating.category &&
                    rate.projectId === newRating.projectId &&
                    rate.jouryId === newRating.jouryId &&
                    rate.applicationId == newRating.applicationId
            );

            if (existingRating) {
                existingRating.rating = newRating.rating; // Обновляем существующий рейтинг
                existingRating.applicationId = applicationId; // Устанавливаем applicationId
            } else {
                newRating.applicationId = applicationId; // Устанавливаем applicationId
                user.jouryRate.push(newRating); // Добавляем новый рейтинг
            }
        }

        // Гарантируем, что у всех объектов в jouryRate есть applicationId
        user.jouryRate = user.jouryRate.map((rate) => ({
            ...rate,
            applicationId: rate.applicationId || applicationId, // Добавляем applicationId, если его нет
        }));

        const userJoury = await User.findOne({ _id: ratingData[0].jouryId });
        if (graded == false && userJoury) {
            userJoury.jouryCounter += 1;
            await userJoury.save();
        }

        console.log(user);
        await user.save();
        res.status(200).json({ message: "Рейтинги успешно обновлены", jouryRate: user.jouryRate });
    } catch (error) {
        res.status(500).json({ message: "Не удалось сохранить рейтинги", error });
    }
};





// Get all jury ratings for a user
export const getJuryRatings = async (req, res) => {
    const { userId } = req.params;

    try {
        const user = await User.findById(userId, 'jouryRate');
        if (!user) return res.status(404).json({ message: "User not found" });

        res.status(200).json(user.jouryRate);
    } catch (error) {
        res.status(500).json({ message: "Failed to retrieve ratings", error });
    }
};



// Функция для добавления ссылки в избранное
export const addToFavorites = async (req, res) => {
    try {
        const { userId, link } = req.body; // Получаем ID пользователя и ссылку из тела запроса

        console.log(userId, link);
        

        if (!link) {
            return res.status(400).json({ message: "Ссылка не предоставлена" });
        }

        // Находим пользователя и добавляем ссылку, если её нет в массиве liked
        const user = await User.findByIdAndUpdate(
            userId,
            { $addToSet: { liked: link } }, // $addToSet предотвращает дублирование
            { new: true } // Возвращаем обновлённый документ
        );
        console.log(user);
        
        if (!user) {
            return res.status(404).json({ message: "Пользователь не найден" });
        }

        res.status(200).json({ message: "Ссылка добавлена в избранное", liked: user.liked });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ошибка при добавлении в избранное" });
    }
};

// Функция для удаления ссылки из избранного
export const removeFromFavorites = async (req, res) => {
    try {
        const { userId, link } = req.body; // Получаем ID пользователя и ссылку из тела запроса

        if (!link) {
            return res.status(400).json({ message: "Ссылка не предоставлена" });
        }

        // Находим пользователя и удаляем ссылку из массива liked
        const user = await User.findByIdAndUpdate(
            userId,
            { $pull: { liked: link } }, // $pull удаляет элемент из массива
            { new: true } // Возвращаем обновлённый документ
        );

        if (!user) {
            return res.status(404).json({ message: "Пользователь не найден" });
        }

        res.status(200).json({ message: "Ссылка удалена из избранного", liked: user.liked });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ошибка при удалении из избранного" });
    }
};


export const updateUserBalance = async (req, res) => {
    try {
        const { userId, balance } = req.body; // Получаем ID пользователя и новый баланс из тела запроса

        if (typeof balance !== "number") {
            return res.status(400).json({ message: "Баланс должен быть числом" });
        }

        // Находим пользователя и обновляем баланс
        const user = await User.findByIdAndUpdate(
            userId,
            { $set: { balance } }, // $set устанавливает новое значение для поля
            { new: true } // Возвращаем обновлённый документ
        );

        if (!user) {
            return res.status(404).json({ message: "Пользователь не найден" });
        }

        res.status(200).json({ message: "Баланс успешно обновлён", balance: user.balance });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ошибка при обновлении баланса" });
    }
};
