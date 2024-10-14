import express, {  Request, Response } from 'express';
import bodyParser from 'body-parser';
import router from './routes/routes';
import dotenv from 'dotenv';
dotenv.config();



const app = express();
const port = process.env.PORT;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use('/',router)

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});