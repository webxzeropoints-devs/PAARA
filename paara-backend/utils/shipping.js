const { round2 } = require('./pricing');

const RATES = {
  chennai: { online: 70, cod: 90 },
  tamilNadu: { online: 80, cod: 100 },
  pondicherry: { online: 90, cod: 100 },
  groupedStates: { online: 110, cod: 130 },
  metroCities: { online: 130, cod: 150 },
};

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
  return String(paymentMethod || '').trim().toLowerCase() === 'cod' ? rates.cod : rates.online;
}

function calculateShipping({ city, state, paymentMethod = 'razorpay', totalWeightKg }) {
  const region = getDeliveryRegion({ city, state });
  if (!region) throw new Error(`No delivery rate is configured for ${city || 'the selected city'}, ${state || 'the selected state'}.`);
  const weight = Number(totalWeightKg);
  if (!Number.isFinite(weight) || weight <= 0) throw new Error('Order weight must be greater than zero to calculate delivery charge.');
  const ratePerKg = rateForRegion(region, paymentMethod);
  return { method: 'region_per_kg', region, ratePerKg, weightKg: round2(weight), amount: round2(ratePerKg * weight) };
}

module.exports = { calculateShipping, getDeliveryRegion, rateForRegion };
