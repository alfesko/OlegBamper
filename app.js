const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');
const {Pool} = require('pg');
const pgSession = require('connect-pg-simple')(session);
const dbConfig = require('./db-config');
const multer = require('multer');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool(dbConfig);

app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session'
    }),
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {secure: false}
}));

app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

async function addUser(username, password) {
    try {
        const hashedPassword = await hashPassword(password);
        const client = await pool.connect();
        await client.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashedPassword]);
        client.release();
        console.log(`Пользователь '${username}' успешно добавлен!`);
    } catch (err) {
        console.error('Ошибка при добавлении пользователя:', err);
    }
}

app.post('/register', (req, res) => {
    const {username, password} = req.body;
    addUser(username, password)
        .then(() => res.send('Пользователь успешно зарегистрирован!'))
        .catch(err => res.status(500).send('Ошибка при регистрации пользователя'));
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({storage: storage});

app.post('/announcement', upload.array('photos', 5), (req, res) => {
    const {
        brand,
        year,
        model,
        engineVolume,
        transmission,
        bodyType,
        description,
        partNumber,
        fuelType,
        fuelSubtype
    } = req.body;

    const photoPaths = req.files.map(file => file.path);

    const query = `
        INSERT INTO announcements (brand, year, model, engine_volume, transmission, body_type,
                                   description, part_number, photos, fuel_type, fuel_subtype)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;

    const values = [
        brand,
        year,
        model,
        engineVolume,
        transmission,
        bodyType,
        description,
        partNumber,
        photoPaths,
        fuelType,
        fuelSubtype
    ];

    pool.query(query, values, (err) => {
        if (err) {
            console.error('Ошибка при добавлении объявления в базу данных:', err);
            return res.status(500).send('Ошибка сервера');
        }
        res.redirect('/');
    });
});
app.get('/edit-announcement/:id', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM announcements WHERE id = $1', [req.params.id]);
        client.release();

        if (result.rows.length === 0) {
            return res.status(404).send('Объявление не найдено');
        }

        res.sendFile(path.join(__dirname, 'protected', 'edit-announcement.html'));
    } catch (err) {
        console.error('Ошибка:', err);
        res.status(500).send('Ошибка сервера');
    }
});
app.use('/uploads', express.static('uploads'));

app.post('/login', async (req, res) => {
    const {username, password} = req.body;
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
        client.release();
        if (result.rows.length > 0) {
            const user = result.rows[0];
            const isPasswordMatch = await bcrypt.compare(password, user.password);
            if (isPasswordMatch) {
                req.session.loggedIn = true;
                res.redirect('/');
            } else {
                res.send('Неверные учетные данные');
            }
        } else {
            res.send('Пользователь не найден');
        }
    } catch (err) {
        console.error('Ошибка при входе:', err);
        res.status(500).send('Ошибка при входе пользователя');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Ошибка при выходе:', err);
            return res.status(500).send('Ошибка при выходе');
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

app.get('/auth-status', (req, res) => {
    res.json({loggedIn: !!req.session.loggedIn});
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'main.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/add-ad', (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'add-ad.html'));
});

app.get('/announcement', (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'add-ad.html'));
});

app.post('/submit-ad', (req, res) => {
    const {brand, model, year, engineVolume, description, bodyType, transmission, fuelType, fuelSubtype} = req.body;
    res.send('Объявление успешно добавлено!');
});
app.get('/api/announcements/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM announcements WHERE id = $1', [id]);
        client.release();

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Объявление не найдено' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Ошибка при получении объявления:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.delete('/api/announcements/:id/photos/:index', async (req, res) => {
    const { id, index } = req.params;

    try {
        const client = await pool.connect();
        const result = await client.query('SELECT photos FROM announcements WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            client.release();
            return res.status(404).json({ error: 'Объявление не найдено' });
        }

        const photos = result.rows[0].photos;
        if (!Array.isArray(photos) || index >= photos.length) {
            client.release();
            return res.status(400).json({ error: 'Некорректный индекс фотографии' });
        }

        photos.splice(index, 1);

        await client.query('UPDATE announcements SET photos = $1 WHERE id = $2', [photos, id]);
        client.release();

        res.status(200).json({ success: true });
    } catch (err) {
        console.error('Ошибка:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/announcements', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM announcements');
        client.release();
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка при получении объявлений:', err);
        res.status(500).send('Ошибка при получении объявлений');
    }
});
app.put('/api/announcements/:id', upload.array('photos', 5), async (req, res) => {
    try {
        const { brand, year, model, engineVolume, transmission, bodyType, description, partNumber, fuelType, fuelSubtype } = req.body;
        const photosToDelete = JSON.parse(req.body.photosToDelete || '[]'); // Получаем список фото для удаления

        const client = await pool.connect();
        const result = await client.query('SELECT photos FROM announcements WHERE id = $1', [req.params.id]);
        const currentPhotos = result.rows[0].photos || [];

        const updatedPhotos = currentPhotos.filter((_, index) => !photosToDelete.includes(index));

        let newPhotos = updatedPhotos;

        if (req.files && req.files.length > 0) {
            const newPhotoPaths = req.files.map(file => file.path);
            newPhotos = updatedPhotos.concat(newPhotoPaths);
        }

        const query = `
            UPDATE announcements
            SET brand = $1, year = $2, model = $3, engine_volume = $4, transmission = $5, body_type = $6,
                description = $7, part_number = $8, fuel_type = $9, fuel_subtype = $10, photos = $11
            WHERE id = $12
        `;

        const values = [
            brand, year, model, engineVolume, transmission, bodyType,
            description, partNumber, fuelType, fuelSubtype, newPhotos, req.params.id
        ];

        await client.query(query, values);
        client.release();

        res.status(200).json({ success: true });
    } catch (err) {
        console.error('Ошибка:', err);
        res.status(500).json({ success: false });
    }
});

app.delete('/api/announcements/:id', async (req, res) => {
    const {id} = req.params;
    try {
        const client = await pool.connect();
        await client.query('DELETE FROM announcements WHERE id = $1', [id]);
        client.release();
        res.status(200).send('Объявление успешно удалено');
    } catch (err) {
        console.error('Ошибка при удалении объявления:', err);
        res.status(500).send('Ошибка при удалении объявления');
    }
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
