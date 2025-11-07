const express = require('express');
const router = express.Router();

// TODO: Реализовать эндпоинты для feedbacks
// POST /api/feedback
router.post('/feedback', (req, res) => {
  res.status(501).json({ error: 'Эндпоинт в разработке' });
});

// GET /api/feedbacks
router.get('/feedbacks', (req, res) => {
  res.status(501).json({ error: 'Эндпоинт в разработке' });
});

// POST /api/feedback/:id/vote
router.post('/feedback/:id/vote', (req, res) => {
  res.status(501).json({ error: 'Эндпоинт в разработке' });
});

module.exports = router;

