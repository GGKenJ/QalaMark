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

// Функция для создания уведомления (используется в других модулях)
const createNotification = async (userId, message, link = null) => {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, message, link)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, message, link]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Ошибка создания уведомления:', error);
    return null;
  }
};

// GET /api/notifications - получить список уведомлений пользователя
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit), parseInt(offset)]
    );

    // Получаем общее количество непрочитанных
    const unreadCount = await pool.query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    res.json({
      notifications: result.rows,
      unreadCount: parseInt(unreadCount.rows[0].count)
    });
  } catch (error) {
    console.error('Ошибка получения уведомлений:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении уведомлений' });
  }
});

// PATCH /api/notifications/:id/read - отметить как прочитанное
router.patch('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Проверяем, что уведомление принадлежит пользователю
    const notificationResult = await pool.query(
      'SELECT * FROM notifications WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (notificationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Уведомление не найдено' });
    }

    // Отмечаем как прочитанное
    const result = await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *',
      [id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка при отметке уведомления:', error);
    res.status(500).json({ error: 'Ошибка сервера при отметке уведомления' });
  }
});

// PATCH /api/notifications/read-all - отметить все как прочитанные
router.patch('/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    res.json({ message: 'Все уведомления отмечены как прочитанные' });
  } catch (error) {
    console.error('Ошибка при отметке всех уведомлений:', error);
    res.status(500).json({ error: 'Ошибка сервера при отметке уведомлений' });
  }
});

// Экспортируем функцию для использования в других модулях
module.exports = { router, createNotification };

