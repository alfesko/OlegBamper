const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const dbConfig = require('./db-config');

const app = express();

const pool = new Pool(dbConfig);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
}));

app.use(express.static(__dirname));

app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/login.html');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
        client.release();

        if (result.rows.length > 0) {
            const user = result.rows[0];

            const match = await bcrypt.compare(password, user.password);
            if (match) {
                req.session.user = username;
                res.send('Авторизация успешна!');
            } else {
                res.status(401).send('Неправильный логин или пароль.');
            }
        } else {
            res.status(401).send('Неправильный логин или пароль.');
        }
    } catch (err) {
        console.error('Ошибка аутентификации:', err);
        res.status(500).send('Внутренняя ошибка сервера.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
