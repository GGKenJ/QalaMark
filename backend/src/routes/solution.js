const express = require('express');
const router = express.Router();
const pool = require('../db');
const { uploadFields } = require('../middleware/upload');
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

// POST /api/solution/:feedbackId - создать решение
router.post('/solution/:feedbackId', authenticateToken, uploadFields, async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const { description } = req.body;
    const staffId = req.user.id;

    // Проверяем, что пользователь - сотрудник
    const userResult = await pool.query('SELECT role, position FROM users WHERE id = $1', [staffId]);
    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'employee') {
      return res.status(403).json({ error: 'Только сотрудники могут создавать решения' });
    }

    const employee = userResult.rows[0];

    // Проверяем, существует ли жалоба
    const feedbackResult = await pool.query('SELECT * FROM feedbacks WHERE id = $1', [feedbackId]);
    if (feedbackResult.rows.length === 0) {
      return res.status(404).json({ error: 'Жалоба не найдена' });
    }

    const feedback = feedbackResult.rows[0];

    // Проверяем, может ли сотрудник решать проблемы данной категории
    const positionToCategories = {
      'police': ['road', 'transport', 'other'],
      'plumber': ['water'],
      'electrician': ['lighting'],
      'road_worker': ['road'],
      'garbage_collector': ['garbage', 'ecology'],
      'lighting_worker': ['lighting'],
      'park_worker': ['parks', 'ecology'],
      'other': ['other']
    };

    if (employee.position) {
      const employeeCategories = positionToCategories[employee.position] || [];
      if (!employeeCategories.includes(feedback.category)) {
        return res.status(403).json({ 
          error: `Вы не можете решать проблемы категории "${feedback.category}". Ваша должность позволяет решать только: ${employeeCategories.join(', ')}` 
        });
      }
    }

    // Обработка загруженного фото
    let photoUrl = null;
    if (req.files && req.files.photo && req.files.photo[0]) {
      photoUrl = `/uploads/${req.files.photo[0].filename}`;
    }

    // Создаем решение
    const solutionResult = await pool.query(
      `INSERT INTO solutions (feedback_id, staff_id, description, photo_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [feedbackId, staffId, description || null, photoUrl]
    );

    const solution = solutionResult.rows[0];

    // Обновляем статус жалобы на 'resolved'
    await pool.query(
      "UPDATE feedbacks SET status = 'resolved' WHERE id = $1",
      [feedbackId]
    );

    // Получаем обновленную жалобу с данными пользователя
    const updatedFeedbackResult = await pool.query(
      `SELECT f.*, u.full_name, u.username 
       FROM feedbacks f 
       LEFT JOIN users u ON f.user_id = u.id 
       WHERE f.id = $1`,
      [feedbackId]
    );

    const updatedFeedback = updatedFeedbackResult.rows[0];

    // Добавляем фидбек в выполненные работы сотрудника (если еще не добавлен)
    const existingWork = await pool.query(
      'SELECT * FROM completed_works WHERE feedback_id = $1 AND user_id = $2',
      [feedbackId, staffId]
    );
    
    if (existingWork.rows.length === 0) {
      await pool.query(
        `INSERT INTO completed_works (feedback_id, user_id, feedback_data)
         VALUES ($1, $2, $3)`,
        [feedbackId, staffId, JSON.stringify(updatedFeedback)]
      );
    }

    // Получаем данные сотрудника для решения
    const staffResult = await pool.query(
      `SELECT id, full_name, username, position FROM users WHERE id = $1`,
      [staffId]
    );
    const solutionWithStaff = {
      ...solution,
      staff: staffResult.rows[0]
    };

    // Отправляем событие через WebSocket
    const io = req.app.get('io');
    if (io) {
      io.emit('solution:new', solutionWithStaff);
      io.emit('feedback:updated', updatedFeedback);
    }

    // Создаем уведомление для автора жалобы (только если решает пользователь с должностью)
    if (feedback.user_id && employee.position) {
      await pool.query(
        `INSERT INTO notifications (user_id, message, link)
         VALUES ($1, $2, $3)`,
        [
          feedback.user_id,
          `Ваша жалоба "${feedback.title}" была решена сотрудником`,
          `/map?feedback=${feedbackId}`
        ]
      );

      if (io) {
        io.emit('notification:new', { user_id: feedback.user_id });
      }
    }

    res.status(201).json(solutionWithStaff);
  } catch (error) {
    console.error('Ошибка создания решения:', error);
    res.status(500).json({ error: 'Ошибка сервера при создании решения' });
  }
});

// GET /api/solutions/:feedbackId - получить все решения к жалобе
router.get('/solutions/:feedbackId', async (req, res) => {
  try {
    const { feedbackId } = req.params;

    const result = await pool.query(
      `SELECT s.*, u.full_name, u.username, u.position
       FROM solutions s
       LEFT JOIN users u ON s.staff_id = u.id
       WHERE s.feedback_id = $1
       ORDER BY s.created_at DESC`,
      [feedbackId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения решений:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении решений' });
  }
});

// POST /api/solutions/:id/like - лайкнуть решение
router.post('/solutions/:id/like', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Проверяем, существует ли решение
    const solutionResult = await pool.query('SELECT * FROM solutions WHERE id = $1', [id]);
    if (solutionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Решение не найдено' });
    }

    const solution = solutionResult.rows[0];

    // Проверяем, лайкал ли пользователь уже это решение
    const likeResult = await pool.query(
      'SELECT * FROM solution_likes WHERE solution_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (likeResult.rows.length > 0) {
      // Убираем лайк
      await pool.query(
        'DELETE FROM solution_likes WHERE solution_id = $1 AND user_id = $2',
        [id, userId]
      );
      await pool.query('UPDATE solutions SET likes = GREATEST(likes - 1, 0) WHERE id = $1', [id]);
    } else {
      // Добавляем лайк
      await pool.query(
        'INSERT INTO solution_likes (solution_id, user_id) VALUES ($1, $2)',
        [id, userId]
      );
      await pool.query('UPDATE solutions SET likes = likes + 1 WHERE id = $1', [id]);
    }

    // Получаем обновленное решение
    const updatedResult = await pool.query(
      `SELECT s.*, u.full_name, u.username, u.position
       FROM solutions s
       LEFT JOIN users u ON s.staff_id = u.id
       WHERE s.id = $1`,
      [id]
    );

    const updatedSolution = updatedResult.rows[0];

    // Если лайков >= 3, помечаем жалобу как archived и добавляем в completed_works
    if (updatedSolution.likes >= 3) {
      const feedbackResult = await pool.query('SELECT * FROM feedbacks WHERE id = $1', [solution.feedback_id]);
      const feedback = feedbackResult.rows[0];

      if (feedback.status !== 'archived') {
        await pool.query("UPDATE feedbacks SET status = 'archived' WHERE id = $1", [solution.feedback_id]);

        // Добавляем в completed_works
        await pool.query(
          `INSERT INTO completed_works (feedback_id, user_id, feedback_data)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [solution.feedback_id, solution.staff_id, JSON.stringify(feedback)]
        );

        // Создаем уведомление для сотрудника
        await pool.query(
          `INSERT INTO notifications (user_id, message, link)
           VALUES ($1, $2, $3)`,
          [
            solution.staff_id,
            `Ваше решение для жалобы "${feedback.title}" получило 5+ подтверждений!`,
            `/map?feedback=${solution.feedback_id}`
          ]
        );

        // Обновляем жалобу через WebSocket
        const updatedFeedbackResult = await pool.query(
          `SELECT f.*, u.full_name, u.username 
           FROM feedbacks f 
           LEFT JOIN users u ON f.user_id = u.id 
           WHERE f.id = $1`,
          [solution.feedback_id]
        );

        const io = req.app.get('io');
        if (io) {
          io.emit('feedback:updated', updatedFeedbackResult.rows[0]);
          io.emit('notification:new', { user_id: solution.staff_id });
        }
      }
    }

    // Отправляем событие через WebSocket
    const io = req.app.get('io');
    if (io) {
      io.emit('solution:updated', updatedSolution);
    }

    res.json(updatedSolution);
  } catch (error) {
    console.error('Ошибка при лайке решения:', error);
    res.status(500).json({ error: 'Ошибка сервера при лайке решения' });
  }
});

module.exports = router;

