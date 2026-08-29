const db = require('../db/database');
const { round2 } = require('./pricing');

const WAREHOUSE_LAT = Number(process.env.WAREHOUSE_LAT);
const WAREHOUSE_LNG = Number(process.env.WAREHOUSE_LNG);
const BASE_FEE = Number(process.env.SHIPPING_BASE_FEE || 49);
const FREE_UNDER_KM = Number(process.env.SHIPPING_FREE_UNDER_KM || 10);
const RATE_PER_KM = Number(process.env.SHIPPING_RATE_PER_KM || 4);
const MAX_CAP = Number(process.env.SHIPPING_MAX_CAP || 349);

/**
 * Haversine distance in km between two lat/lng points.
 */
function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = deg => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate shipping cost for an address.
 * 1. If the address city matches one of our named cities, use its flat rate.
 * 2. Otherwise, if lat/lng is available (e.g. resolved from pincode on the
 *    frontend via a geocoding lookup), fall back to a distance-based slab.
 * 3. If neither is available, use a safe default flat rate.
 */
function calculateShipping({ city, lat, lng }) {
  if (city) {
    const row = db
      .prepare('SELECT flat_shipping_rate FROM cities WHERE LOWER(name) = LOWER(?)')
      .get(city.trim());
    if (row) {
      return { method: 'flat_city', city, amount: row.flat_shipping_rate };
    }
  }

  if (lat != null && lng != null && !Number.isNaN(WAREHOUSE_LAT)) {
    const km = distanceKm(WAREHOUSE_LAT, WAREHOUSE_LNG, lat, lng);
    if (km <= FREE_UNDER_KM) {
      return { method: 'distance', distanceKm: round2(km), amount: BASE_FEE };
    }
    const amount = Math.min(BASE_FEE + (km - FREE_UNDER_KM) * RATE_PER_KM, MAX_CAP);
    return { method: 'distance', distanceKm: round2(km), amount: round2(amount) };
  }

  // Fallback when we truly have no location signal
  return { method: 'default', amount: MAX_CAP };
}

module.exports = { calculateShipping, distanceKm };
