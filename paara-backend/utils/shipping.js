const { round2 } = require('./pricing');
const db = require('../db/database');

const RATES = {
  chennai: { online: 70, cod: 90 },
  tamilNadu: { online: 80, cod: 100 },
  pondicherry: { online: 90, cod: 100 },
  groupedStates: { online: 110, cod: 130 },
  metroCities: { online: 130, cod: 150 },
};

function normalizePaymentMethod(paymentMethod) {
  const raw = String(paymentMethod || '').trim().toLowerCase();
  if (raw === 'cod') return 'cod';
  if (raw === 'razorpay' || raw === 'manual_upi' || raw === 'online') return 'online';
  return 'online';
}

function getFlatCityRate(city) {
  const normalizedCity = String(city || '').trim();
  if (!normalizedCity) return null;
  const row = db.prepare('SELECT name, flat_shipping_rate FROM cities WHERE lower(name) = lower(?)').get(normalizedCity);
  if (!row) return null;
  return Number(row.flat_shipping_rate || 0);
}

function getDeliveryRegion({ city, state }) {
  const normalizedCity = String(city || '').trim().toLowerCase();
  const normalizedState = String(state || '').trim().toLowerCase();
  if (normalizedCity === 'chennai') return 'Chennai';
  if (normalizedCity === 'pondicherry' || normalizedCity === 'puducherry') return 'Pondicherry';
  if (['mumbai', 'kolkata', 'delhi'].includes(normalizedCity)) return 'Mumbai / Kolkata / Delhi';
  if (normalizedState === 'tamil nadu') return 'Tamil Nadu (rest of state)';
  if (['andhra pradesh', 'kerala', 'karnataka'].includes(normalizedState)) return 'Andhra Pradesh / Kerala / Karnataka';
  return null;
}

function rateForRegion(region, paymentMethod) {
  const rates = region === 'Chennai' ? RATES.chennai
    : region === 'Tamil Nadu (rest of state)' ? RATES.tamilNadu
      : region === 'Pondicherry' ? RATES.pondicherry
        : region === 'Andhra Pradesh / Kerala / Karnataka' ? RATES.groupedStates
          : region === 'Mumbai / Kolkata / Delhi' ? RATES.metroCities : null;
  if (!rates) return null;
  return normalizePaymentMethod(paymentMethod) === 'cod' ? rates.cod : rates.online;
}

function calculateShipping({ city, state, paymentMethod = 'razorpay', totalWeightKg }) {
  const normalizedCity = String(city || '').trim();
  const flatRate = getFlatCityRate(normalizedCity);
  if (flatRate !== null) {
    return {
      method: 'flat_city_rate',
      city: normalizedCity,
      state: String(state || '').trim(),
      amount: round2(flatRate),
      ratePerKg: null,
      weightKg: Number(totalWeightKg) || 0,
    };
  }

  const region = getDeliveryRegion({ city, state });
  if (!region) throw new Error(`No delivery rate is configured for ${city || 'the selected city'}, ${state || 'the selected state'}.`);
  const weight = Number(totalWeightKg);
  if (!Number.isFinite(weight) || weight <= 0) throw new Error('Order weight must be greater than zero to calculate delivery charge.');
  const ratePerKg = rateForRegion(region, paymentMethod);
  return { method: 'region_per_kg', region, ratePerKg, weightKg: round2(weight), amount: round2(ratePerKg * weight) };
}

module.exports = { calculateShipping, getDeliveryRegion, rateForRegion };
