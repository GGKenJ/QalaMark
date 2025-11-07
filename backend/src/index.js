const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS настройки для фронтенда
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const corsOptions = {
  origin: FRONTEND_ORIGIN,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false, // JWT передаём через Authorization, куки не используем
  optionsSuccessStatus: 204
};

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Preflight для всех роутов
app.use(express.json()); // Парсинг JSON тела запроса
app.use(express.urlencoded({ extended: true })); // Парсинг URL-encoded данных

// Статические файлы (загруженные фото)
app.use('/uploads', express.static('uploads'));

// Подключение роутов
const authRoutes = require('./routes/auth');
const feedbackRoutes = require('./routes/feedback');
const adminRoutes = require('./routes/admin');

app.use('/api', authRoutes);
app.use('/api', feedbackRoutes);
app.use('/api', adminRoutes);

// Базовый роут для проверки
app.get('/', (req, res) => {
  res.json({ message: 'QalaMark API работает!' });
});

// Обработка 404
app.use((req, res) => {
  res.status(404).json({ error: 'Эндпоинт не найден' });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📡 API доступно по адресу http://localhost:${PORT}/api`);
});

module.exports = app;

