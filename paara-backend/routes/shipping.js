const express = require('express');
const { calculateShipping } = require('../utils/shipping');
const db = require('../db/database');

const router = express.Router();

// GET /api/shipping/cities — the 10 named cities with flat rates (for a dropdown, etc.)
router.get('/cities', (req, res) => {
  res.json(db.prepare('SELECT name, flat_shipping_rate FROM cities ORDER BY name').all());
});

// POST /api/shipping/quote  { city } or { lat, lng }
router.post('/quote', (req, res) => {
  const { city, state, payment_method = 'razorpay', total_weight_kg = 0.1 } = req.body;
  try {
    return res.json(calculateShipping({ city, state, paymentMethod: payment_method, totalWeightKg: total_weight_kg }));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

module.exports = router;
