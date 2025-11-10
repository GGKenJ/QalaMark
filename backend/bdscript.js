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
    await client.query('DROP TABLE IF EXISTS solution_likes CASCADE;');
    await client.query('DROP TABLE IF EXISTS notifications CASCADE;');
    await client.query('DROP TABLE IF EXISTS solutions CASCADE;');
    await client.query('DROP TABLE IF EXISTS completed_works CASCADE;');
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
        role VARCHAR(20) DEFAULT 'user',
        position VARCHAR(100),
        full_name VARCHAR(100),
        email VARCHAR(100),
        phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        dislikes INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'new',
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        is_anonymous BOOLEAN DEFAULT false,
        address TEXT,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Таблица feedbacks создана');

    // 4. Создаём таблицу likes (лайки и дизлайки)
    console.log('👍 Создание таблицы likes...');
    await client.query(`
      CREATE TABLE likes (
        id SERIAL PRIMARY KEY,
        feedback_id INT REFERENCES feedbacks(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        vote_type VARCHAR(10) DEFAULT 'like',
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
        is_anonymous BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Таблица comments создана');

    // 6. Создаём таблицу completed_works (завершенные работы сотрудников)
    console.log('✅ Создание таблицы completed_works...');
    await client.query(`
      CREATE TABLE completed_works (
        id SERIAL PRIMARY KEY,
        feedback_id INT REFERENCES feedbacks(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        feedback_data JSONB
      );
    `);
    console.log('✅ Таблица completed_works создана');

    // 7. Создаём таблицу solutions (решения сотрудников)
    console.log('🔧 Создание таблицы solutions...');
    await client.query(`
      CREATE TABLE solutions (
        id SERIAL PRIMARY KEY,
        feedback_id INT REFERENCES feedbacks(id) ON DELETE CASCADE,
        staff_id INT REFERENCES users(id) ON DELETE CASCADE,
        description TEXT,
        photo_url TEXT,
        likes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Таблица solutions создана');

    // 8. Создаём таблицу notifications (уведомления)
    console.log('🔔 Создание таблицы notifications...');
    await client.query(`
      CREATE TABLE notifications (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        link TEXT,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Таблица notifications создана');

    // 9. Создаём таблицу solution_likes (лайки решений)
    console.log('👍 Создание таблицы solution_likes...');
    await client.query(`
      CREATE TABLE solution_likes (
        id SERIAL PRIMARY KEY,
        solution_id INT REFERENCES solutions(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (solution_id, user_id)
      );
    `);
    console.log('✅ Таблица solution_likes создана');

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

    // Добавляем тестовых пользователей
    console.log('\n👥 Добавление тестовых пользователей...');
    const bcrypt = require('bcrypt');
    const testPassword = await bcrypt.hash('password123', 10);
    
    // Обычный пользователь
    await client.query(`
      INSERT INTO users (username, password_hash, role, full_name, email, phone)
      VALUES ('user@test.com', $1, 'user', 'Тестовый Пользователь', 'user@test.com', '+77001234567')
      ON CONFLICT (username) DO NOTHING
    `, [testPassword]);
    
    // Сотрудник (дорожный рабочий)
    await client.query(`
      INSERT INTO users (username, password_hash, role, position, full_name, email, phone)
      VALUES ('employee@test.com', $1, 'employee', 'road_worker', 'Иванов Иван Иванович', 'employee@test.com', '+77001234568')
      ON CONFLICT (username) DO NOTHING
    `, [testPassword]);
    
    // Администратор
    await client.query(`
      INSERT INTO users (username, password_hash, role, full_name, email, phone)
      VALUES ('admin@test.com', $1, 'admin', 'Администратор Системы', 'admin@test.com', '+77001234569')
      ON CONFLICT (username) DO NOTHING
    `, [testPassword]);
    
    console.log('✅ Тестовые пользователи добавлены');
    console.log('   - user@test.com / password123 (обычный пользователь)');
    console.log('   - employee@test.com / password123 (сотрудник)');
    console.log('   - admin@test.com / password123 (администратор)');

    // Добавляем тестовые уведомления
    console.log('\n🔔 Добавление тестовых уведомлений...');
    try {
      // Получаем ID пользователей
      const userResult = await client.query("SELECT id FROM users WHERE username = 'user@test.com'");
      const employeeResult = await client.query("SELECT id FROM users WHERE username = 'employee@test.com'");
      
      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;
        // Проверяем, есть ли уже уведомления для этого пользователя
        const existingNotifications = await client.query(
          "SELECT COUNT(*) as count FROM notifications WHERE user_id = $1",
          [userId]
        );
        
        if (parseInt(existingNotifications.rows[0].count) === 0) {
          await client.query(`
            INSERT INTO notifications (user_id, message, link, is_read)
            VALUES 
              ($1, 'Добро пожаловать в QalaMark! Это тестовое уведомление.', '/map', false),
              ($1, 'Ваша жалоба была рассмотрена.', '/map', false)
          `, [userId]);
          console.log('✅ Тестовые уведомления для пользователя добавлены');
        } else {
          console.log('✅ У пользователя уже есть уведомления');
        }
      }
      
      if (employeeResult.rows.length > 0) {
        const employeeId = employeeResult.rows[0].id;
        // Проверяем, есть ли уже уведомления для этого сотрудника
        const existingNotifications = await client.query(
          "SELECT COUNT(*) as count FROM notifications WHERE user_id = $1",
          [employeeId]
        );
        
        if (parseInt(existingNotifications.rows[0].count) === 0) {
          await client.query(`
            INSERT INTO notifications (user_id, message, link, is_read)
            VALUES 
              ($1, 'Новая жалоба в категории "дорога" требует вашего внимания.', '/map', false),
              ($1, 'У вас есть новые задачи для выполнения.', '/map', false)
          `, [employeeId]);
          console.log('✅ Тестовые уведомления для сотрудника добавлены');
        } else {
          console.log('✅ У сотрудника уже есть уведомления');
        }
      }
    } catch (err) {
      console.log('⚠️  Не удалось добавить тестовые уведомления:', err.message);
    }

    // Создаём индексы для оптимизации запросов
    console.log('\n⚡ Создание индексов...');
    await client.query('CREATE INDEX idx_feedbacks_status ON feedbacks(status);');
    await client.query('CREATE INDEX idx_feedbacks_category ON feedbacks(category);');
    await client.query('CREATE INDEX idx_feedbacks_location ON feedbacks(lat, lon);');
    await client.query('CREATE INDEX idx_feedbacks_user_id ON feedbacks(user_id);');
    await client.query('CREATE INDEX idx_likes_feedback_id ON likes(feedback_id);');
    await client.query('CREATE INDEX idx_likes_user_id ON likes(user_id);');
    await client.query('CREATE INDEX idx_comments_feedback_id ON comments(feedback_id);');
    await client.query('CREATE INDEX idx_comments_user_id ON comments(user_id);');
    await client.query('CREATE INDEX idx_completed_works_user_id ON completed_works(user_id);');
    await client.query('CREATE INDEX idx_solutions_feedback_id ON solutions(feedback_id);');
    await client.query('CREATE INDEX idx_solutions_staff_id ON solutions(staff_id);');
    await client.query('CREATE INDEX idx_notifications_user_id ON notifications(user_id);');
    await client.query('CREATE INDEX idx_notifications_is_read ON notifications(is_read);');
    await client.query('CREATE INDEX idx_solution_likes_solution_id ON solution_likes(solution_id);');
    await client.query('CREATE INDEX idx_solution_likes_user_id ON solution_likes(user_id);');
    console.log('✅ Индексы созданы');

    // Проверяем и добавляем новые колонки, если их нет
    console.log('\n🔍 Проверка и добавление новых полей...');
    
    const columnsToCheck = [
      { name: 'video_url', type: 'TEXT', table: 'feedbacks' },
      { name: 'dislikes', type: 'INTEGER DEFAULT 0', table: 'feedbacks' },
      { name: 'user_id', type: 'INT REFERENCES users(id) ON DELETE SET NULL', table: 'feedbacks' },
      { name: 'is_anonymous', type: 'BOOLEAN DEFAULT false', table: 'feedbacks' },
      { name: 'address', type: 'TEXT', table: 'feedbacks' },
      { name: 'comment', type: 'TEXT', table: 'feedbacks' },
      { name: 'position', type: 'VARCHAR(100)', table: 'users' },
      { name: 'full_name', type: 'VARCHAR(100)', table: 'users' },
      { name: 'email', type: 'VARCHAR(100)', table: 'users' },
      { name: 'phone', type: 'VARCHAR(20)', table: 'users' },
      { name: 'created_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP', table: 'users' },
      { name: 'vote_type', type: "VARCHAR(10) DEFAULT 'like'", table: 'likes' },
      { name: 'is_anonymous', type: 'BOOLEAN DEFAULT false', table: 'comments' }
    ];

    for (const col of columnsToCheck) {
      const check = await client.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = '${col.table}' AND column_name = '${col.name}'`
      );
      
      if (check.rows.length === 0) {
        console.log(`📝 Добавляю поле ${col.name} в таблицу ${col.table}...`);
        try {
          await client.query(`ALTER TABLE ${col.table} ADD COLUMN ${col.name} ${col.type}`);
          console.log(`✅ Поле ${col.name} добавлено!`);
        } catch (err) {
          console.log(`⚠️  Не удалось добавить ${col.name}: ${err.message}`);
        }
      } else {
        console.log(`✅ Поле ${col.name} уже существует`);
      }
    }

    console.log('\n✨ База данных QalaMark успешно инициализирована!');
    console.log('\n📊 Созданные таблицы:');
    console.log('   - users (id, username, password_hash, role, position, full_name, email, phone, created_at)');
    console.log('   - categories (name, keywords[])');
    console.log('   - feedbacks (id, title, description, category, lat, lon, photo_url, video_url, votes, dislikes, status, user_id, is_anonymous, address, comment, created_at)');
    console.log('   - likes (лайки и дизлайки пользователей)');
    console.log('   - comments (комментарии)');
    console.log('   - completed_works (завершенные работы сотрудников)');
    console.log('   - solutions (решения сотрудников)');
    console.log('   - notifications (уведомления)');
    console.log('   - solution_likes (лайки решений)');
    
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