const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');

// Middleware для проверки токена
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Токен не предоставлен' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Недействительный токен' });
    }
    req.user = user;
    next();
  });
};

// Маппинг должностей к категориям
const positionToCategories = {
  'police': ['road', 'transport', 'other'],
  'plumber': ['water'],
  'electrician': ['lighting'],
  'road_worker': ['road', 'transport'],
  'garbage_collector': ['garbage', 'ecology'], // Мусор и экология для сборщика мусора
  'lighting_worker': ['lighting'],
  'park_worker': ['parks', 'ecology'],
  'other': ['other']
};

// GET /api/employee/tasks - получение задач для сотрудника
router.get('/tasks', authenticateToken, async (req, res) => {
  try {
    // Получаем должность пользователя
    const userResult = await pool.query('SELECT position FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0 || userResult.rows[0].position === null) {
      return res.json([]);
    }

    const position = userResult.rows[0].position;
    const categories = positionToCategories[position] || ['other'];

    // Получаем задачи по категориям должности
    const result = await pool.query(
      `SELECT * FROM feedbacks 
       WHERE category = ANY($1::text[]) 
       AND status = 'new'
       ORDER BY created_at DESC`,
      [categories]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения задач сотрудника:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/employee/complete/:id - завершение задачи
router.post('/complete/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Получаем данные жалобы
    const feedbackResult = await pool.query('SELECT * FROM feedbacks WHERE id = $1', [id]);
    if (feedbackResult.rows.length === 0) {
      return res.status(404).json({ error: 'Жалоба не найдена' });
    }

    const feedback = feedbackResult.rows[0];

    // Сохраняем в completed_works
    await pool.query(
      `INSERT INTO completed_works (feedback_id, user_id, feedback_data) 
       VALUES ($1, $2, $3)`,
      [id, req.user.id, JSON.stringify(feedback)]
    );

    // Удаляем жалобу из feedbacks (или меняем статус на 'completed')
    await pool.query('UPDATE feedbacks SET status = $1 WHERE id = $2', ['completed', id]);

    res.json({ success: true, message: 'Задача выполнена' });
  } catch (error) {
    console.error('Ошибка завершения задачи:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/employee/completed-works - получение завершенных работ
router.get('/completed-works', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM completed_works WHERE user_id = $1 ORDER BY completed_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения завершенных работ:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;

