const { round2 } = require('./pricing');
const db = require('../db/database');

const RATES = {
  chennai: { online: 70, cod: 90 },
  tamilNadu: { online: 80, cod: 100 },
  pondicherry: { online: 90, cod: 110 },
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

  const row = db.prepare('SELECT name, flat_shipping_rate FROM cities WHERE lower(trim(name)) = lower(trim(?))').get(normalizedCity);
  if (!row) return null;

  const flatRate = Number(row.flat_shipping_rate);
  return Number.isFinite(flatRate) ? flatRate : null;
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
  const region = getDeliveryRegion({ city, state });
  if (!region) {
    throw new Error(`No delivery rate is configured for ${city || 'the selected city'}, ${state || 'the selected state'}.`);
  }

  const amount = rateForRegion(region, paymentMethod);
  if (amount == null) {
    throw new Error(`No delivery rate is configured for ${city || 'the selected city'}, ${state || 'the selected state'}.`);
  }

  return {
    method: 'flat_city_rate',
    city: normalizedCity,
    state: String(state || '').trim(),
    amount: round2(amount),
    ratePerKg: null,
    weightKg: Number(totalWeightKg) || 0,
  };
}

module.exports = { calculateShipping, getDeliveryRegion, rateForRegion };
