const express = require('express');
const router = express.Router();

// TODO: Реализовать регистрацию и авторизацию
// POST /api/register
router.post('/register', (req, res) => {
  res.status(501).json({ error: 'Эндпоинт в разработке' });
});

// POST /api/login
router.post('/login', (req, res) => {
  res.status(501).json({ error: 'Эндпоинт в разработке' });
});

module.exports = router;

