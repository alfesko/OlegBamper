const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const dbConfig = require('./db-config');

const pool = new Pool(dbConfig);

async function addUser(username, password) {
    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const client = await pool.connect();
        const result = await client.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashedPassword]);
        client.release();

        console.log(`Пользователь с логином '${username}' успешно добавлен в базу данных!`);
    } catch (err) {
        console.error('Ошибка при добавлении пользователя:', err);
    }
}

addUser('oleg', 'oleg27062024');
