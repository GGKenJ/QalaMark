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

    // Получаем данные пользователя для новой жалобы
    const feedbackWithUser = await pool.query(
      `SELECT f.*, u.full_name, u.username 
       FROM feedbacks f 
       LEFT JOIN users u ON f.user_id = u.id 
       WHERE f.id = $1`,
      [result.rows[0].id]
    );

    const newFeedback = feedbackWithUser.rows[0];

    // Маппинг должностей к категориям
    const positionToCategories = {
      'police': ['road', 'transport', 'other'],
      'plumber': ['water', 'garbage'],
      'electrician': ['lighting'],
      'road_worker': ['road'],
      'garbage_collector': ['garbage', 'ecology'],
      'lighting_worker': ['lighting'],
      'park_worker': ['parks', 'ecology'],
      'other': ['other']
    };

    // Создаем уведомления для ближайших пользователей (в радиусе 1 км)
    // Функция для расчета расстояния между двумя точками (формула гаверсинуса)
    const getDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371; // Радиус Земли в км
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c; // Расстояние в км
    };

    // Получаем всех пользователей с их последним известным местоположением
    // Для MVP используем упрощенный подход - уведомляем всех активных пользователей
    // В реальной системе нужно хранить последнее местоположение пользователя в таблице user_locations
    const nearbyUsersResult = await pool.query(
      `SELECT id FROM users WHERE role = 'user' AND id != $1`,
      [userId || 0]
    );

    // Уведомляем ближайших пользователей (в радиусе 1 км)
    // В реальной системе нужно проверять расстояние через таблицу user_locations
    // Пока уведомляем всех пользователей с сообщением о проблеме поблизости
    for (const user of nearbyUsersResult.rows) {
      await pool.query(
        `INSERT INTO notifications (user_id, message, link)
         VALUES ($1, $2, $3)`,
        [
          user.id,
          `Новая проблема поблизости (до 1 км): "${newFeedback.title}" - проверьте, пожалуйста!`,
          `/map?feedback=${newFeedback.id}`
        ]
      );
    }

    // Создаем уведомления для пользователей с должностью соответствующей категории
    // (включая как сотрудников, так и обычных пользователей с должностью)
    const usersWithPositionResult = await pool.query(
      `SELECT id, position FROM users WHERE position IS NOT NULL`
    );

    for (const userWithPosition of usersWithPositionResult.rows) {
      const userCategories = positionToCategories[userWithPosition.position] || [];
      if (userCategories.includes(newFeedback.category)) {
        // Создаем уведомление для пользователя с должностью
        await pool.query(
          `INSERT INTO notifications (user_id, message, link)
           VALUES ($1, $2, $3)`,
          [
            userWithPosition.id,
            `Новая жалоба "${newFeedback.title}" в категории "${newFeedback.category}"`,
            `/map?feedback=${newFeedback.id}`
          ]
        );
      }
    }

    // Отправляем событие через WebSocket
    const io = req.app.get('io');
    if (io) {
      // Отмечаем жалобу как новую (для мигающей метки)
      newFeedback.is_new = true;
      io.emit('feedback:new', newFeedback);
      
      // Отправляем уведомления ближайшим пользователям
      for (const user of nearbyUsersResult.rows) {
        io.emit('notification:new', { user_id: user.id });
      }
      
      // Отправляем уведомления пользователям с должностью
      for (const userWithPosition of usersWithPositionResult.rows) {
        const userCategories = positionToCategories[userWithPosition.position] || [];
        if (userCategories.includes(newFeedback.category)) {
          io.emit('notification:new', { user_id: userWithPosition.id });
        }
      }
    }

    res.status(201).json(newFeedback);
  } catch (error) {
    console.error('Ошибка создания жалобы:', error);
    res.status(500).json({ error: 'Ошибка сервера при создании жалобы' });
  }
});

// GET /api/feedbacks - получение списка жалоб
router.get('/feedbacks', async (req, res) => {
  try {
    const { category, status, bbox } = req.query;

    let query = `SELECT f.*, u.full_name, u.username 
                 FROM feedbacks f 
                 LEFT JOIN users u ON f.user_id = u.id 
                 WHERE f.status != $1`;
    const params = ['completed']; // Исключаем завершенные задачи
    let paramCount = 1;

    if (category && category !== 'all') {
      paramCount++;
      query += ` AND f.category = $${paramCount}`;
      params.push(category);
    }

    if (status) {
      paramCount++;
      query += ` AND f.status = $${paramCount}`;
      params.push(status);
    }

    // Фильтр по bbox (bounding box) для карты
    if (bbox) {
      const [minLat, minLon, maxLat, maxLon] = bbox.split(',').map(parseFloat);
      paramCount++;
      query += ` AND f.lat >= $${paramCount}`;
      params.push(minLat);
      paramCount++;
      query += ` AND f.lat <= $${paramCount}`;
      params.push(maxLat);
      paramCount++;
      query += ` AND f.lon >= $${paramCount}`;
      params.push(minLon);
      paramCount++;
      query += ` AND f.lon <= $${paramCount}`;
      params.push(maxLon);
    }

    query += ' ORDER BY f.created_at DESC';

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

    // Возвращаем обновленную жалобу с данными пользователя
    const updatedResult = await pool.query(
      `SELECT f.*, u.full_name, u.username 
       FROM feedbacks f 
       LEFT JOIN users u ON f.user_id = u.id 
       WHERE f.id = $1`,
      [id]
    );
    const updatedFeedback = updatedResult.rows[0];

    // Если лайков >= 3, создаем уведомления для сотрудников по категории
    if (updatedFeedback.votes >= 3 && updatedFeedback.status === 'new') {
      // Получаем маппинг должностей к категориям
      const positionToCategories = {
        'police': ['road', 'transport', 'other'],
        'plumber': ['water', 'garbage'],
        'electrician': ['lighting'],
        'road_worker': ['road'],
        'garbage_collector': ['garbage', 'ecology'],
        'lighting_worker': ['lighting'],
        'park_worker': ['parks', 'ecology'],
        'other': ['other']
      };

      // Находим пользователей с должностью, чьи категории соответствуют категории жалобы
      const usersWithPositionResult = await pool.query(
        `SELECT id, position FROM users WHERE position IS NOT NULL`
      );

      for (const userWithPosition of usersWithPositionResult.rows) {
        const userCategories = positionToCategories[userWithPosition.position] || [];
        if (userCategories.includes(updatedFeedback.category)) {
          // Создаем уведомление для пользователя с должностью
          await pool.query(
            `INSERT INTO notifications (user_id, message, link)
             VALUES ($1, $2, $3)`,
            [
              userWithPosition.id,
              `Жалоба "${updatedFeedback.title}" получила 3+ подтверждения - реальная проблема! Требуется исправление.`,
              `/map?feedback=${id}`
            ]
          );

          // Отправляем событие через WebSocket
          const io = req.app.get('io');
          if (io) {
            io.emit('notification:new', { user_id: userWithPosition.id });
          }
        }
      }
    }

    // Отправляем событие через WebSocket
    const io = req.app.get('io');
    if (io) {
      io.emit('feedback:updated', updatedFeedback);
    }

    res.json(updatedFeedback);
  } catch (error) {
    console.error('Ошибка при голосовании:', error);
    res.status(500).json({ error: 'Ошибка сервера при голосовании' });
  }
});

// PATCH /api/feedback/:id/comment - добавить комментарий к жалобе
router.patch('/feedback/:id/comment', async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Комментарий не может быть пустым' });
    }

    // Проверяем, существует ли жалоба
    const feedbackResult = await pool.query('SELECT * FROM feedbacks WHERE id = $1', [id]);
    if (feedbackResult.rows.length === 0) {
      return res.status(404).json({ error: 'Жалоба не найдена' });
    }

    // Обновляем комментарий (добавляем к существующему или создаем новый)
    const existingComment = feedbackResult.rows[0].comment || '';
    const newComment = existingComment 
      ? `${existingComment}\n\n${comment.trim()}` 
      : comment.trim();

    await pool.query(
      'UPDATE feedbacks SET comment = $1 WHERE id = $2',
      [newComment, id]
    );

    // Получаем обновленную жалобу
    const updatedResult = await pool.query(
      `SELECT f.*, u.full_name, u.username 
       FROM feedbacks f 
       LEFT JOIN users u ON f.user_id = u.id 
       WHERE f.id = $1`,
      [id]
    );

    const updatedFeedback = updatedResult.rows[0];

    // Получаем ID пользователя, который оставил комментарий (из токена)
    let commenterId = null;
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        commenterId = decoded.id;
      } catch (err) {
        // Токен невалиден
      }
    }

    // Получаем io для WebSocket
    const io = req.app.get('io');

    // Создаем уведомление для владельца поста (если комментарий оставил не сам владелец)
    if (updatedFeedback.user_id && commenterId && updatedFeedback.user_id !== commenterId) {
      // Получаем имя пользователя, который оставил комментарий
      const commenterResult = await pool.query(
        'SELECT full_name, username FROM users WHERE id = $1',
        [commenterId]
      );
      const commenterName = commenterResult.rows[0]?.full_name || 
                           commenterResult.rows[0]?.username || 
                           'Пользователь';

      await pool.query(
        `INSERT INTO notifications (user_id, message, link)
         VALUES ($1, $2, $3)`,
        [
          updatedFeedback.user_id,
          `${commenterName} оставил комментарий к вашей жалобе "${updatedFeedback.title}"`,
          `/map?feedback=${id}`
        ]
      );

      // Отправляем событие через WebSocket
      if (io) {
        io.emit('notification:new', { user_id: updatedFeedback.user_id });
      }
    }

    // Отправляем событие через WebSocket
    if (io) {
      io.emit('feedback:updated', updatedFeedback);
    }

    res.json(updatedFeedback);
  } catch (error) {
    console.error('Ошибка при добавлении комментария:', error);
    res.status(500).json({ error: 'Ошибка сервера при добавлении комментария' });
  }
});

module.exports = router;
