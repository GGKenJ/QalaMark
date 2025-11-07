const express = require('express');
const router = express.Router();

// TODO: Реализовать админские эндпоинты
// PATCH /api/feedback/:id/status
router.patch('/feedback/:id/status', (req, res) => {
  res.status(501).json({ error: 'Эндпоинт в разработке' });
});

module.exports = router;

