const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Разрешаем запросы с фронтенда
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

