const pool = require('./src/db');

async function checkVideoColumn() {
  try {
    const result = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'feedbacks' AND column_name = 'video_url'"
    );
    
    if (result.rows.length === 0) {
      console.log('Добавляю поле video_url...');
      await pool.query('ALTER TABLE feedbacks ADD COLUMN video_url TEXT');
      console.log('✅ Поле video_url добавлено!');
    } else {
      console.log('✅ Поле video_url уже существует');
    }
    
    console.log('✅ База данных готова!');
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await pool.end();
  }
}

checkVideoColumn();

