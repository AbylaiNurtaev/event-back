import express from 'express';
import mongoose from 'mongoose';
import chalk from 'chalk';
import handleValidationErrors from './utils/handleValidationErrors.js';
import dotenv from 'dotenv';
dotenv.config();

import cors from 'cors'
import * as UserController from './controllers/UserController.js'

import checkAuth from './utils/checkAuth.js';
import { ArticleController } from './controllers/index.js';
import checkAdmin from './utils/checkAdmin.js';


const errorMsg = chalk.bgWhite.redBright;
const successMsg = chalk.bgGreen.white;


// mongoose.connect(process.env.MONGODB_URI)
mongoose.connect('mongodb+srv://wedsastana:20060903@cluster0.h2di1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')

.then(() => console.log(successMsg("DB ok")))
.catch((err) => console.log(errorMsg("DB error:", err)))

const app = express();

app.use(express.json());
app.use(cors())

app.post('/auth/login', handleValidationErrors, UserController.login)
app.post('/auth/register', handleValidationErrors, UserController.register)

app.get('/article', ArticleController.getAll);
app.post('/article',  ArticleController.create);
app.delete('/article/:name', checkAdmin, ArticleController.remove);
app.patch('/article/update/:title', checkAdmin, ArticleController.updateInfo);


const port = process.env.PORT || 3001

app.listen(port, function(){
    console.log(successMsg("listening port:", port));
  });



