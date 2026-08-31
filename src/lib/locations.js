import { City, State } from "country-state-city";

const INDIA_COUNTRY_CODE = "IN";
const INDIA_STATES = State.getStatesOfCountry(INDIA_COUNTRY_CODE);

// The previous local map covered only 14 of India's 36 states and union
// territories. Generate both lists from one complete dataset so the state
// selector and city lookup always use the same canonical names.
export const INDIAN_STATES = INDIA_STATES.map((state) => state.name);

export const STATE_CITIES = Object.fromEntries(
  INDIA_STATES.map((state) => [
    state.name,
    [...new Set(City.getCitiesOfState(INDIA_COUNTRY_CODE, state.isoCode).map((city) => city.name))]
      .sort((first, second) => first.localeCompare(second)),
  ])
);
