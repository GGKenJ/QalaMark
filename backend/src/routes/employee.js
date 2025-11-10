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
  'road_worker': ['road'],
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

    // Получаем данные сотрудника
    const userResult = await pool.query('SELECT role, position FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'employee') {
      return res.status(403).json({ error: 'Только сотрудники могут завершать задачи' });
    }

    const employee = userResult.rows[0];

    // Получаем данные жалобы
    const feedbackResult = await pool.query('SELECT * FROM feedbacks WHERE id = $1', [id]);
    if (feedbackResult.rows.length === 0) {
      return res.status(404).json({ error: 'Жалоба не найдена' });
    }

    const feedback = feedbackResult.rows[0];

    // Проверяем, может ли сотрудник решать проблемы данной категории
    if (employee.position) {
      const employeeCategories = positionToCategories[employee.position] || [];
      if (!employeeCategories.includes(feedback.category)) {
        return res.status(403).json({ 
          error: `Вы не можете завершать задачи категории "${feedback.category}". Ваша должность позволяет решать только: ${employeeCategories.join(', ')}` 
        });
      }
    }

    // Сохраняем в completed_works
    await pool.query(
      `INSERT INTO completed_works (feedback_id, user_id, feedback_data) 
       VALUES ($1, $2, $3)`,
      [id, req.user.id, JSON.stringify(feedback)]
    );

    // Обновляем статус жалобы на 'completed'
    await pool.query('UPDATE feedbacks SET status = $1 WHERE id = $2', ['completed', id]);

    // Получаем обновленную жалобу с данными пользователя
    const updatedFeedbackResult = await pool.query(
      `SELECT f.*, u.full_name, u.username 
       FROM feedbacks f 
       LEFT JOIN users u ON f.user_id = u.id 
       WHERE f.id = $1`,
      [id]
    );
    const updatedFeedback = updatedFeedbackResult.rows[0];

    // Создаем уведомление для автора жалобы (только если решает пользователь с должностью)
    if (feedback.user_id && employee.position) {
      await pool.query(
        `INSERT INTO notifications (user_id, message, link)
         VALUES ($1, $2, $3)`,
        [
          feedback.user_id,
          `Ваша жалоба "${feedback.title}" была решена сотрудником`,
          `/map?feedback=${id}`
        ]
      );
    }

    // Отправляем событие через WebSocket
    const io = req.app.get('io');
    if (io) {
      io.emit('feedback:completed', updatedFeedback);
      if (feedback.user_id && employee.position) {
        io.emit('notification:new', { user_id: feedback.user_id });
      }
    }

    res.json({ success: true, message: 'Задача выполнена', feedback: updatedFeedback });
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

