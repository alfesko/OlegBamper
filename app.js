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
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.post('/register', async (req, res) => {
    const {username, password, confirmPassword} = req.body;

    if (!username || !password || !confirmPassword) {
        return res.status(400).send('Заполните все поля.');
    }

    if (password !== confirmPassword) {
        return res.status(400).send('Пароли не совпадают.');
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const client = await pool.connect();

        await client.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashedPassword]);
        client.release();

        res.redirect('/login');
    } catch (err) {
        console.error('Ошибка при регистрации:', err);
        res.status(500).send('Ошибка сервера.');
    }
});

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

function generateArticle() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let article = '';
    for (let i = 0; i < 8; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        article += characters[randomIndex];
    }
    return article;
}

app.post('/announcement', upload.array('photos', 5), async (req, res) => {
    if (!req.session.loggedIn) {
        return res.status(401).send('Вы должны быть авторизованы для добавления объявления.');
    }

    const userId = req.session.userId;

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
        fuelSubtype,
        part,
        price
    } = req.body;

    const photoPaths = req.files.map(file => file.path);
    const article = generateArticle();

    const query = `
        INSERT INTO announcements (brand, year, model, engine_volume, transmission, body_type,
                                   description, part_number, photos, fuel_type, fuel_subtype, part, price, article,
                                   user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
        fuelSubtype,
        part,
        price,
        article,
        userId
    ];

    try {
        await pool.query(query, values);
        res.redirect('/');
    } catch (err) {
        console.error('Ошибка при добавлении объявления:', err);
        res.status(500).send('Ошибка сервера');
    }
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
                req.session.userId = user.id; // Сохраняем ID пользователя
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

app.get('/auth-status', async (req, res) => {
    if (!req.session.userId) {
        return res.json({ loggedIn: false });
    }

    try {
        const result = await pool.query(
            'SELECT id, is_admin FROM users WHERE id = $1',
            [req.session.userId]
        );

        if (result.rows.length > 0) {
            res.json({
                loggedIn: true,
                userId: req.session.userId,
                isAdmin: result.rows[0].is_admin
            });
        } else {
            res.json({ loggedIn: false });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
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
    const {id} = req.params;
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM announcements WHERE id = $1', [id]);
        client.release();

        if (result.rows.length === 0) {
            return res.status(404).json({error: 'Объявление не найдено'});
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Ошибка при получении объявления:', err);
        res.status(500).json({error: 'Ошибка сервера'});
    }
});

app.delete('/api/announcements/:id/photos/:index', async (req, res) => {
    const {id, index} = req.params;

    try {
        const client = await pool.connect();
        const result = await client.query('SELECT photos FROM announcements WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            client.release();
            return res.status(404).json({error: 'Объявление не найдено'});
        }

        const photos = result.rows[0].photos;
        if (!Array.isArray(photos) || index >= photos.length) {
            client.release();
            return res.status(400).json({error: 'Некорректный индекс фотографии'});
        }

        photos.splice(index, 1);

        await client.query('UPDATE announcements SET photos = $1 WHERE id = $2', [photos, id]);
        client.release();

        res.status(200).json({success: true});
    } catch (err) {
        console.error('Ошибка:', err);
        res.status(500).json({error: 'Ошибка сервера'});
    }
});

async function getCurrencyRates() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM currency_rates ORDER BY updated_at DESC LIMIT 1');
        client.release();

        if (result.rows.length > 0) {
            return result.rows[0];
        } else {
            return null;
        }
    } catch (err) {
        console.error('Ошибка при получении курсов валют:', err);
        return null;
    }
}

app.get('/api/announcements', async (req, res) => {
    try {
        const { user_id, page = 1, limit = 3, sort = 'date_desc' } = req.query;
        const offset = (page - 1) * limit;

        const client = await pool.connect();

        let orderBy;
        switch (sort) {
            case 'price_asc':
                orderBy = 'price ASC';
                break;
            case 'price_desc':
                orderBy = 'price DESC';
                break;
            case 'date_asc':
                orderBy = 'created_at ASC';
                break;
            case 'date_desc':
            default:
                orderBy = 'created_at DESC';
                break;
        }

        let query = `
            SELECT a.*, 
                   (a.user_id = $1) AS is_owner
            FROM announcements a
        `;
        const values = [req.session.userId || null];
        let paramIndex = 2;

        if (user_id) {
            query += ` WHERE a.user_id = $${paramIndex++}`;
            values.push(user_id);
        }

        query += ` ORDER BY ${orderBy} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        values.push(parseInt(limit), parseInt(offset));

        let countQuery = `SELECT COUNT(*) FROM announcements`;
        const countValues = [];
        if (user_id) {
            countQuery += ` WHERE user_id = $1`;
            countValues.push(user_id);
        }

        const [announcementsResult, countResult] = await Promise.all([
            client.query(query, values),
            client.query(countQuery, countValues)
        ]);

        client.release();

        const total = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(total / limit);

        const announcements = announcementsResult.rows;
        const currencyRates = await getCurrencyRates();

        if (!currencyRates) {
            return res.status(500).json({error: 'Курсы валют не найдены'});
        }

        const announcementsWithPrices = announcements.map(announcement => ({
            ...announcement,
            price_eur: (announcement.price * currencyRates.usd_to_byn / currencyRates.eur_to_byn).toFixed(2),
            price_byn: (announcement.price * currencyRates.usd_to_byn).toFixed(2),
            price_rub: (announcement.price * currencyRates.usd_to_byn / currencyRates.rub_to_byn * 100).toFixed(2)
        }));

        res.json({
            announcements: announcementsWithPrices,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalItems: total
            }
        });
    } catch (err) {
        console.error('Ошибка:', err);
        res.status(500).json({error: 'Ошибка сервера'});
    }
});

app.put('/api/announcements/:id', upload.array('photos', 5), async (req, res) => {
    if (!req.session.loggedIn) {
        return res.status(401).send('Вы должны быть авторизованы.');
    }

    const userId = req.session.userId;
    const { id } = req.params;

    try {
        const client = await pool.connect();

        const userResult = await client.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
        const isAdmin = userResult.rows[0]?.is_admin;

        if (!isAdmin) {
            const announcementResult = await client.query('SELECT user_id FROM announcements WHERE id = $1', [id]);
            if (announcementResult.rows.length === 0) {
                client.release();
                return res.status(404).send('Объявление не найдено');
            }

            if (announcementResult.rows[0].user_id !== userId) {
                client.release();
                return res.status(403).send('Недостаточно прав для редактирования этого объявления');
            }
        }

        const currentResult = await client.query('SELECT photos FROM announcements WHERE id = $1', [id]);
        let currentPhotos = currentResult.rows[0].photos || [];

        const photosToDelete = JSON.parse(req.body.photosToDelete || '[]');
        if (photosToDelete.length > 0) {
            // Удаляем фото из массива (сортировка по убыванию чтобы не сбивались индексы)
            photosToDelete.sort((a, b) => b - a).forEach(index => {
                if (index >= 0 && index < currentPhotos.length) {
                    currentPhotos.splice(index, 1);
                }
            });
        }

        const newPhotos = req.files.map(file => file.path);
        const updatedPhotos = [...currentPhotos, ...newPhotos];

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
            fuelSubtype,
            part,
            price
        } = req.body;

        const query = `
            UPDATE announcements
            SET brand = $1,
                year = $2,
                model = $3,
                engine_volume = $4,
                transmission = $5,
                body_type = $6,
                description = $7,
                part_number = $8,
                fuel_type = $9,
                fuel_subtype = $10,
                part = $11,
                price = $12,
                photos = $13
            WHERE id = $14
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
            fuelType,
            fuelSubtype,
            part,
            price,
            updatedPhotos,
            id
        ];

        await client.query(query, values);
        client.release();

        res.status(200).send('Объявление успешно обновлено');
    } catch (err) {
        console.error('Ошибка при обновлении объявления:', err);
        res.status(500).send('Ошибка сервера');
    }
});

app.delete('/api/announcements/:id', async (req, res) => {
    if (!req.session.loggedIn) {
        return res.status(401).send('Вы должны быть авторизованы.');
    }

    try {
        const userId = req.session.userId;
        const { id } = req.params;
        const userResult = await pool.query(
            'SELECT is_admin FROM users WHERE id = $1',
            [userId]
        );
        const isAdmin = userResult.rows[0]?.is_admin;

        if (!isAdmin) {
            const announcementResult = await pool.query(
                'SELECT user_id FROM announcements WHERE id = $1',
                [id]
            );

            if (announcementResult.rows.length === 0) {
                return res.status(404).send('Объявление не найдено');
            }

            if (announcementResult.rows[0].user_id !== userId) {
                return res.status(403).send('Недостаточно прав');
            }
        }

        const photosResult = await pool.query(
            'SELECT photos FROM announcements WHERE id = $1',
            [id]
        );

        await pool.query('DELETE FROM announcements WHERE id = $1', [id]);

        if (photosResult.rows.length > 0 && photosResult.rows[0].photos) {
            const photos = photosResult.rows[0].photos;
            for (const photoPath of photos) {
                try {
                    fs.unlinkSync(photoPath); // Удаляем файл
                } catch (err) {
                    console.error(`Ошибка при удалении файла ${photoPath}:`, err);
                }
            }
        }

        res.status(200).send('Объявление успешно удалено');
    } catch (err) {
        console.error('Ошибка при удалении объявления:', err);
        res.status(500).send('Ошибка сервера');
    }
});


app.get('/api/currency-rates', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM currency_rates ORDER BY updated_at DESC LIMIT 1');
        client.release();

        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({error: 'Курсы валют не найдены'});
        }
    } catch (err) {
        console.error('Ошибка при получении курсов валют:', err);
        res.status(500).json({error: 'Ошибка сервера'});
    }
});
app.get('/search', async (req, res) => {
    const {
        brand,
        year,
        model,
        engineVolume,
        transmission,
        bodyType,
        fuelType,
        fuelSubtype,
        article,
        part,
        partNumber,
        page = 1,
        limit = 3,
        sort = 'date_desc'
    } = req.query;

    const offset = (page - 1) * limit;

    try {
        const client = await pool.connect();

        let orderBy;
        switch (sort) {
            case 'price_asc':
                orderBy = 'price ASC';
                break;
            case 'price_desc':
                orderBy = 'price DESC';
                break;
            case 'date_asc':
                orderBy = 'created_at ASC';
                break;
            case 'date_desc':
            default:
                orderBy = 'created_at DESC';
                break;
        }

        let query = `
            SELECT a.*, 
                   (a.user_id = $1) AS is_owner
            FROM announcements a
            WHERE 1=1
        `;
        const values = [req.session.userId || null];
        let paramIndex = 2;

        if (brand) {
            query += ` AND brand ILIKE $${paramIndex++}`;
            values.push(`%${brand}%`);
        }
        if (year) {
            query += ` AND year = $${paramIndex++}`;
            values.push(year);
        }
        if (model) {
            query += ` AND model ILIKE $${paramIndex++}`;
            values.push(`%${model}%`);
        }
        if (engineVolume) {
            query += ` AND engine_volume = $${paramIndex++}`;
            values.push(engineVolume);
        }
        if (transmission) {
            query += ` AND transmission = $${paramIndex++}`;
            values.push(transmission);
        }
        if (bodyType) {
            query += ` AND body_type = $${paramIndex++}`;
            values.push(bodyType);
        }
        if (fuelType) {
            query += ` AND fuel_type = $${paramIndex++}`;
            values.push(fuelType);
        }
        if (fuelSubtype) {
            query += ` AND fuel_subtype = $${paramIndex++}`;
            values.push(fuelSubtype);
        }
        if (article) {
            query += ` AND article = $${paramIndex++}`;
            values.push(article);
        }
        if (part) {
            query += ` AND part ILIKE $${paramIndex++}`;
            values.push(`%${part}%`);
        }
        if (partNumber) {
            query += ` AND part_number = $${paramIndex++}`;
            values.push(partNumber);
        }

        query += ` ORDER BY ${orderBy} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        values.push(parseInt(limit), parseInt(offset));

        let countQuery = `SELECT COUNT(*) FROM announcements WHERE 1=1`;
        const countValues = [];
        let countParamIndex = 1;

        if (brand) {
            countQuery += ` AND brand ILIKE $${countParamIndex++}`;
            countValues.push(`%${brand}%`);
        }
        if (year) {
            countQuery += ` AND year = $${countParamIndex++}`;
            countValues.push(year);
        }
        if (model) {
            countQuery += ` AND model ILIKE $${countParamIndex++}`;
            countValues.push(`%${model}%`);
        }
        if (engineVolume) {
            countQuery += ` AND engine_volume = $${countParamIndex++}`;
            countValues.push(engineVolume);
        }
        if (transmission) {
            countQuery += ` AND transmission = $${countParamIndex++}`;
            countValues.push(transmission);
        }
        if (bodyType) {
            countQuery += ` AND body_type = $${countParamIndex++}`;
            countValues.push(bodyType);
        }
        if (fuelType) {
            countQuery += ` AND fuel_type = $${countParamIndex++}`;
            countValues.push(fuelType);
        }
        if (fuelSubtype) {
            countQuery += ` AND fuel_subtype = $${countParamIndex++}`;
            countValues.push(fuelSubtype);
        }
        if (article) {
            countQuery += ` AND article = $${countParamIndex++}`;
            countValues.push(article);
        }
        if (part) {
            countQuery += ` AND part ILIKE $${countParamIndex++}`;
            countValues.push(`%${part}%`);
        }
        if (partNumber) {
            countQuery += ` AND part_number = $${countParamIndex++}`;
            countValues.push(partNumber);
        }

        const [announcementsResult, countResult] = await Promise.all([
            client.query(query, values),
            client.query(countQuery, countValues)
        ]);

        client.release();

        const total = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(total / limit);

        const announcements = announcementsResult.rows;
        const currencyRates = await getCurrencyRates();

        if (!currencyRates) {
            return res.status(500).json({error: 'Курсы валют не найдены'});
        }

        const results = announcements.map(announcement => ({
            ...announcement,
            price_usd: announcement.price,
            price_eur: (announcement.price * currencyRates.usd_to_byn / currencyRates.eur_to_byn).toFixed(2),
            price_byn: (announcement.price * currencyRates.usd_to_byn).toFixed(2),
            price_rub: (announcement.price * currencyRates.usd_to_byn / currencyRates.rub_to_byn * 100).toFixed(2)
        }));

        res.json({
            announcements: results,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalItems: total
            }
        });
    } catch (err) {
        console.error('Ошибка при поиске объявлений:', err);
        res.status(500).json({error: 'Ошибка сервера'});
    }
});
async function requireAdmin(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }

    try {
        const result = await pool.query(
            'SELECT is_admin FROM users WHERE id = $1',
            [req.session.userId]
        );

        if (result.rows[0]?.is_admin) {
            next();
        } else {
            res.status(403).json({ error: 'Требуются права администратора' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
}
app.post('/api/currency-rates', requireAdmin, async (req, res) => {
    const { eur, usd, rub } = req.body;

    if (!eur || !usd || !rub) {
        return res.status(400).json({error: 'Все поля обязательны'});
    }

    try {
        const client = await pool.connect();
        await client.query(
            'INSERT INTO currency_rates (eur_to_byn, usd_to_byn, rub_to_byn) VALUES ($1, $2, $3)',
            [eur, usd, rub]
        );
        client.release();

        res.status(200).json({success: true});
    } catch (err) {
        console.error('Ошибка при обновлении курсов валют:', err);
        res.status(500).json({error: 'Ошибка сервера'});
    }
});
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});

async function loadAnnouncements(page = 1, sortType = 'date_desc') {
    try {
        const response = await fetch(`/api/announcements?page=${page}&sort=${sortType}`);
        const data = await response.json();

        const announcementsContainer = document.getElementById('announcements');
        announcementsContainer.innerHTML = '';

        data.announcements.forEach(announcement => {
            const announcementElement = document.createElement('div');
            announcementElement.className = 'announcement-item';
            announcementElement.innerHTML = `
        <h3>${announcement.brand} - ${announcement.model}</h3>
        <p>Год: ${announcement.year}</p>
        <p>Цена: ${announcement.price_byn} BYN</p>
        ${announcement.photos && announcement.photos.length > 0 ?
                `<img src="${announcement.photos[0]}" alt="Фото запчасти" class="announcement-photo">` : ''}
      `;
            announcementsContainer.appendChild(announcementElement);
        });

        updatePagination(data.pagination);
    } catch (error) {
        console.error('Ошибка загрузки объявлений:', error);
    }
}