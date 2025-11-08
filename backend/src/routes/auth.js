const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
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

// POST /api/auth/register - регистрация
router.post('/register', async (req, res) => {
  try {
    const { username, password, role, position, full_name, email, phone } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }

    // Если сотрудник, проверяем наличие должности
    if (role === 'employee' && !position) {
      return res.status(400).json({ error: 'Для сотрудника необходимо указать должность' });
    }

    // Проверяем, существует ли пользователь
    const existingUser = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Пользователь с таким номером телефона уже существует' });
    }

    // Хешируем пароль
    const passwordHash = await bcrypt.hash(password, 10);

    // Создаем пользователя
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role, position, full_name, email, phone) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, username, role, position, full_name, email, phone`,
      [username, passwordHash, role || 'user', position || null, full_name || null, email || null, phone || username]
    );

    const user = result.rows[0];

    // Генерируем токен
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, position: user.position },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        position: user.position,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});

// POST /api/auth/login - вход
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
    }

    // Находим пользователя
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверный номер телефона или пароль' });
    }

    const user = result.rows[0];

    // Проверяем пароль
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Неверный номер телефона или пароль' });
    }

    // Генерируем токен
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
});

// GET /api/auth/me - получение информации о текущем пользователе
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, role, position, full_name, email, phone, created_at FROM users WHERE id = $1', 
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка получения информации о пользователе:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;

