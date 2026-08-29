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
  const { city, lat, lng } = req.body;
  if (!city && (lat == null || lng == null)) {
    return res.status(400).json({ error: 'Provide either a city name or lat/lng.' });
  }
  const quote = calculateShipping({ city, lat, lng });
  res.json(quote);
});

module.exports = router;
