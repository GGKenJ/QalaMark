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

// GET /api/user/posts - получение постов пользователя
router.get('/posts', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM feedbacks WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения постов пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/user/comments - получение комментариев пользователя
router.get('/comments', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, f.title as feedback_title 
       FROM comments c 
       LEFT JOIN feedbacks f ON c.feedback_id = f.id 
       WHERE c.user_id = $1 
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения комментариев пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;

