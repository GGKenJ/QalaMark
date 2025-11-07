const { Pool } = require('pg');

const postgresPool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'password',
  database: 'postgres',
  port: 5432
});

async function initDatabase() {
  const client = await postgresPool.connect();
  
  try {
    console.log('🚀 Начинаем инициализацию базы данных QalaMark...\n');

    // Удаляем таблицы если существуют (в обратном порядке зависимостей)
    console.log('📦 Удаление существующих таблиц...');
    await client.query('DROP TABLE IF EXISTS comments CASCADE;');
    await client.query('DROP TABLE IF EXISTS likes CASCADE;');
    await client.query('DROP TABLE IF EXISTS reports CASCADE;');
    await client.query('DROP TABLE IF EXISTS categories CASCADE;');
    await client.query('DROP TABLE IF EXISTS users CASCADE;');
    console.log('✅ Старые таблицы удалены\n');

    // 1. Создаём таблицу users
    console.log('👤 Создание таблицы users...');
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Таблица users создана');

    // 2. Создаём таблицу categories (опциональная, но полезная)
    console.log('🏷️  Создание таблицы categories...');
    await client.query(`
      CREATE TABLE categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        color VARCHAR(10) DEFAULT '#2E7D32',
        icon VARCHAR(100)
      );
    `);
    console.log('✅ Таблица categories создана');

    // 3. Создаём таблицу reports
    console.log('📍 Создание таблицы reports...');
    await client.query(`
      CREATE TABLE reports (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        title VARCHAR(100) NOT NULL,
        description TEXT,
        category VARCHAR(50),
        latitude DECIMAL(10, 7) NOT NULL,
        longitude DECIMAL(10, 7) NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Таблица reports создана');

    // 4. Создаём таблицу likes
    console.log('👍 Создание таблицы likes...');
    await client.query(`
      CREATE TABLE likes (
        id SERIAL PRIMARY KEY,
        report_id INT REFERENCES reports(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (report_id, user_id)
      );
    `);
    console.log('✅ Таблица likes создана');

    // 5. Создаём таблицу comments
    console.log('💬 Создание таблицы comments...');
    await client.query(`
      CREATE TABLE comments (
        id SERIAL PRIMARY KEY,
        report_id INT REFERENCES reports(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Таблица comments создана');

    // Добавляем начальные категории
    console.log('\n🎨 Добавление начальных категорий...');
    await client.query(`
      INSERT INTO categories (name, color, icon) VALUES
        ('дорога', '#FF5722', 'road'),
        ('запах', '#9C27B0', 'smell'),
        ('мусор', '#795548', 'trash'),
        ('вода', '#2196F3', 'water'),
        ('освещение', '#FFC107', 'light'),
        ('другое', '#607D8B', 'other');
    `);
    console.log('✅ Категории добавлены');

    // Создаём индексы для оптимизации запросов
    console.log('\n⚡ Создание индексов...');
    await client.query('CREATE INDEX idx_reports_user_id ON reports(user_id);');
    await client.query('CREATE INDEX idx_reports_status ON reports(status);');
    await client.query('CREATE INDEX idx_reports_location ON reports(latitude, longitude);');
    await client.query('CREATE INDEX idx_likes_report_id ON likes(report_id);');
    await client.query('CREATE INDEX idx_comments_report_id ON comments(report_id);');
    console.log('✅ Индексы созданы');

    console.log('\n✨ База данных QalaMark успешно инициализирована!');
    console.log('\n📊 Созданные таблицы:');
    console.log('   - users (пользователи)');
    console.log('   - categories (категории проблем)');
    console.log('   - reports (отметки на карте)');
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

// Запускаем инициализацию
initDatabase()
  .then(() => {
    console.log('\n🎉 Готово! Можно запускать приложение.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Фатальная ошибка:', error.message);
    process.exit(1);
  });