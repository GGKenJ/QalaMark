const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'password',
  database: 'postgres',
  port: 5432
});

async function createDatabase() {
  try {
    // Проверяем, существует ли база данных
    const result = await pool.query(
      "SELECT 1 FROM pg_database WHERE datname = 'qalamark'"
    );
    
    if (result.rows.length === 0) {
      console.log('Создаю базу данных qalamark...');
      await pool.query('CREATE DATABASE qalamark');
      console.log('✅ База данных qalamark создана!');
    } else {
      console.log('✅ База данных qalamark уже существует');
    }
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await pool.end();
  }
}

createDatabase();

