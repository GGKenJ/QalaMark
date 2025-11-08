const express = require('express');
const router = express.Router();
const pool = require('../db');
const { uploadFields } = require('../middleware/upload');
const { categorize } = require('../utils/categorize');
const jwt = require('jsonwebtoken');

// POST /api/feedback - создание жалобы
router.post('/feedback', uploadFields, async (req, res) => {
  try {
    const { title, description, category, lat, lon, address, comment, is_anonymous } = req.body;
    
    // Получаем user_id из токена, если есть
    let userId = null;
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        userId = decoded.id;
      } catch (err) {
        // Токен невалиден, но продолжаем без user_id
      }
    }

    if (!title || !lat || !lon) {
      return res.status(400).json({ error: 'Заголовок, широта и долгота обязательны' });
    }

    // Определяем категорию автоматически, если не указана
    let finalCategory = category || 'other';
    if (description) {
      const autoCategory = categorize(description);
      // Маппинг категорий из categorize в нужный формат
      const categoryMap = {
        'дорога': 'road',
        'мусор': 'ecology',
        'запах': 'ecology',
        'освещение': 'lighting',
        'вода': 'other',
        'другое': 'other'
      };
      finalCategory = categoryMap[autoCategory] || category || 'other';
    }

    // Обработка загруженных файлов
    let photoUrl = null;
    let videoUrl = null;

    if (req.files) {
      if (req.files.photo && req.files.photo[0]) {
        photoUrl = `/uploads/${req.files.photo[0].filename}`;
      }
      if (req.files.video && req.files.video[0]) {
        videoUrl = `/uploads/${req.files.video[0].filename}`;
      }
    }

    // Вставляем жалобу в БД
    const result = await pool.query(
      `INSERT INTO feedbacks (title, description, category, lat, lon, photo_url, video_url, votes, dislikes, status, user_id, is_anonymous, address, comment)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        title, 
        description || null, 
        finalCategory, 
        parseFloat(lat), 
        parseFloat(lon), 
        photoUrl, 
        videoUrl, 
        0, 
        0,
        'new',
        userId,
        is_anonymous === 'true' || is_anonymous === true,
        address || null,
        comment || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка создания жалобы:', error);
    res.status(500).json({ error: 'Ошибка сервера при создании жалобы' });
  }
});

// GET /api/feedbacks - получение списка жалоб
router.get('/feedbacks', async (req, res) => {
  try {
    const { category, status, bbox } = req.query;

    let query = 'SELECT * FROM feedbacks WHERE status != $1';
    const params = ['completed']; // Исключаем завершенные задачи
    let paramCount = 1;

    if (category && category !== 'all') {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    // Фильтр по bbox (bounding box) для карты
    if (bbox) {
      const [minLat, minLon, maxLat, maxLon] = bbox.split(',').map(parseFloat);
      paramCount++;
      query += ` AND lat >= $${paramCount}`;
      params.push(minLat);
      paramCount++;
      query += ` AND lat <= $${paramCount}`;
      params.push(maxLat);
      paramCount++;
      query += ` AND lon >= $${paramCount}`;
      params.push(minLon);
      paramCount++;
      query += ` AND lon <= $${paramCount}`;
      params.push(maxLon);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения жалоб:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении жалоб' });
  }
});

// POST /api/feedback/:id/vote - голосование за жалобу
router.post('/feedback/:id/vote', async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body; // 'like' или 'dislike'
    const voteType = type || 'like';
    
    // Получаем user_id из токена
    let userId = null;
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        userId = decoded.id;
      } catch (err) {
        // Токен невалиден
      }
    }

    // Проверяем, существует ли жалоба
    const feedbackResult = await pool.query('SELECT * FROM feedbacks WHERE id = $1', [id]);
    if (feedbackResult.rows.length === 0) {
      return res.status(404).json({ error: 'Жалоба не найдена' });
    }

    if (userId) {
      // Проверяем существующий голос
      const existingVote = await pool.query(
        'SELECT * FROM likes WHERE feedback_id = $1 AND user_id = $2',
        [id, userId]
      );

      if (existingVote.rows.length > 0) {
        const currentVote = existingVote.rows[0].vote_type;
        
        if (currentVote === voteType) {
          // Убираем голос
          await pool.query('DELETE FROM likes WHERE feedback_id = $1 AND user_id = $2', [id, userId]);
          if (voteType === 'like') {
            await pool.query('UPDATE feedbacks SET votes = GREATEST(votes - 1, 0) WHERE id = $1', [id]);
          } else {
            await pool.query('UPDATE feedbacks SET dislikes = GREATEST(dislikes - 1, 0) WHERE id = $1', [id]);
          }
        } else {
          // Меняем тип голоса
          await pool.query(
            'UPDATE likes SET vote_type = $1 WHERE feedback_id = $2 AND user_id = $3',
            [voteType, id, userId]
          );
          if (currentVote === 'like') {
            await pool.query('UPDATE feedbacks SET votes = GREATEST(votes - 1, 0), dislikes = dislikes + 1 WHERE id = $1', [id]);
          } else {
            await pool.query('UPDATE feedbacks SET votes = votes + 1, dislikes = GREATEST(dislikes - 1, 0) WHERE id = $1', [id]);
          }
        }
      } else {
        // Добавляем новый голос
        await pool.query(
          'INSERT INTO likes (feedback_id, user_id, vote_type) VALUES ($1, $2, $3)',
          [id, userId, voteType]
        );
        if (voteType === 'like') {
          await pool.query('UPDATE feedbacks SET votes = votes + 1 WHERE id = $1', [id]);
        } else {
          await pool.query('UPDATE feedbacks SET dislikes = dislikes + 1 WHERE id = $1', [id]);
        }
      }
    } else {
      // Без авторизации просто увеличиваем счетчик
      if (voteType === 'like') {
        await pool.query('UPDATE feedbacks SET votes = votes + 1 WHERE id = $1', [id]);
      } else {
        await pool.query('UPDATE feedbacks SET dislikes = dislikes + 1 WHERE id = $1', [id]);
      }
    }

    // Возвращаем обновленную жалобу
    const updatedResult = await pool.query('SELECT * FROM feedbacks WHERE id = $1', [id]);
    res.json(updatedResult.rows[0]);
  } catch (error) {
    console.error('Ошибка при голосовании:', error);
    res.status(500).json({ error: 'Ошибка сервера при голосовании' });
  }
});

module.exports = router;
