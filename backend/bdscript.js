const { Pool } = require('pg');

// Пул для подключения к системной БД postgres (для создания БД)
const systemPool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'password',
  database: 'postgres',
  port: 5432
});

// Пул для работы с БД qalamark (для создания таблиц)
const postgresPool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'password',
  database: 'qalamark',
  port: 5432
});

async function createDatabase() {
  const client = await systemPool.connect();
  
  try {
    // Проверяем, существует ли база данных
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'qalamark'"
    );
    
    if (result.rows.length === 0) {
      console.log('📦 Создаю базу данных qalamark...');
      await client.query('CREATE DATABASE qalamark');
      console.log('✅ База данных qalamark создана!\n');
    } else {
      console.log('✅ База данных qalamark уже существует\n');
    }
  } catch (error) {
    console.error('❌ Ошибка при создании базы данных:', error.message);
    throw error;
  } finally {
    client.release();
    await systemPool.end();
  }
}

async function initDatabase() {
  const client = await postgresPool.connect();
  
  try {
    console.log('🚀 Начинаем инициализацию базы данных QalaMark...\n');

    // Удаляем таблицы если существуют (в обратном порядке зависимостей)
    console.log('📦 Удаление существующих таблиц...');
    await client.query('DROP TABLE IF EXISTS comments CASCADE;');
    await client.query('DROP TABLE IF EXISTS likes CASCADE;');
    await client.query('DROP TABLE IF EXISTS feedbacks CASCADE;');
    await client.query('DROP TABLE IF EXISTS categories CASCADE;');
    await client.query('DROP TABLE IF EXISTS users CASCADE;');
    console.log('✅ Старые таблицы удалены\n');

    // 1. Создаём таблицу users
    console.log('👤 Создание таблицы users...');
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(20) DEFAULT 'user'
      );
    `);
    console.log('✅ Таблица users создана');

    // 2. Создаём таблицу categories
    console.log('🏷️  Создание таблицы categories...');
    await client.query(`
      CREATE TABLE categories (
        name VARCHAR(50) PRIMARY KEY,
        keywords TEXT[] NOT NULL
      );
    `);
    console.log('✅ Таблица categories создана');

    // 3. Создаём таблицу feedbacks
    console.log('📍 Создание таблицы feedbacks...');
    await client.query(`
      CREATE TABLE feedbacks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        description TEXT,
        category VARCHAR(50),
        lat DECIMAL(10, 7) NOT NULL,
        lon DECIMAL(10, 7) NOT NULL,
        photo_url TEXT,
        video_url TEXT,
        votes INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Таблица feedbacks создана');

    // 4. Создаём таблицу likes
    console.log('👍 Создание таблицы likes...');
    await client.query(`
      CREATE TABLE likes (
        id SERIAL PRIMARY KEY,
        feedback_id INT REFERENCES feedbacks(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (feedback_id, user_id)
      );
    `);
    console.log('✅ Таблица likes создана');

    // 5. Создаём таблицу comments
    console.log('💬 Создание таблицы comments...');
    await client.query(`
      CREATE TABLE comments (
        id SERIAL PRIMARY KEY,
        feedback_id INT REFERENCES feedbacks(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Таблица comments создана');

    // Добавляем начальные категории
    console.log('\n🎨 Добавление начальных категорий...');
    await client.query(`
      INSERT INTO categories (name, keywords) VALUES
        ('дорога', ARRAY['дорога', 'яма', 'выбоина', 'асфальт', 'тротуар']),
        ('запах', ARRAY['запах', 'вонь', 'газ', 'дым', 'загазованность']),
        ('мусор', ARRAY['мусор', 'отходы', 'свалка', 'контейнер', 'чистота']),
        ('вода', ARRAY['вода', 'канализация', 'лужа', 'протечка', 'затопление']),
        ('освещение', ARRAY['освещение', 'фонарь', 'лампа', 'темнота', 'свет']),
        ('другое', ARRAY['другое', 'прочее', 'иное']);
    `);
    console.log('✅ Категории добавлены');

    // Создаём индексы для оптимизации запросов
    console.log('\n⚡ Создание индексов...');
    await client.query('CREATE INDEX idx_feedbacks_status ON feedbacks(status);');
    await client.query('CREATE INDEX idx_feedbacks_category ON feedbacks(category);');
    await client.query('CREATE INDEX idx_feedbacks_location ON feedbacks(lat, lon);');
    await client.query('CREATE INDEX idx_likes_feedback_id ON likes(feedback_id);');
    await client.query('CREATE INDEX idx_comments_feedback_id ON comments(feedback_id);');
    console.log('✅ Индексы созданы');

    // Проверяем и добавляем колонку video_url, если её нет
    console.log('\n🎬 Проверка колонки video_url...');
    const videoColumnCheck = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'feedbacks' AND column_name = 'video_url'"
    );
    
    if (videoColumnCheck.rows.length === 0) {
      console.log('📹 Добавляю поле video_url...');
      await client.query('ALTER TABLE feedbacks ADD COLUMN video_url TEXT');
      console.log('✅ Поле video_url добавлено!');
    } else {
      console.log('✅ Поле video_url уже существует');
    }

    console.log('\n✨ База данных QalaMark успешно инициализирована!');
    console.log('\n📊 Созданные таблицы:');
    console.log('   - users (id, username, password_hash, role)');
    console.log('   - categories (name, keywords[])');
    console.log('   - feedbacks (id, title, description, category, lat, lon, photo_url, video_url, votes, status, created_at)');
    console.log('   - likes (голоса пользователей)');
    console.log('   - comments (комментарии)');
    
  } catch (error) {
    console.error('❌ Ошибка при инициализации базы данных:', error);
    throw error;
  } finally {
    client.release();
    await postgresPool.end();
  }
}

// Запускаем создание БД, затем инициализацию таблиц
createDatabase()
  .then(() => {
    // Небольшая задержка для завершения создания БД в PostgreSQL
    return new Promise(resolve => setTimeout(resolve, 500));
  })
  .then(() => {
    return initDatabase();
  })
  .then(() => {
    console.log('\n🎉 Готово! Можно запускать приложение.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Фатальная ошибка:', error.message);
    process.exit(1);
  });