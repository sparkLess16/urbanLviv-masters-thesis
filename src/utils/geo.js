// Keep in sync with backend/src/utils/geo.js.
export const LVIV_BOUNDS = {
  minLat: 49.77,
  maxLat: 49.92,
  minLng: 23.89,
  maxLng: 24.14,
};

export const LVIV_CENTER = { lat: 49.8397, lng: 24.0297 };

export const isWithinLviv = (lat, lng) =>
  lat >= LVIV_BOUNDS.minLat &&
  lat <= LVIV_BOUNDS.maxLat &&
  lng >= LVIV_BOUNDS.minLng &&
  lng <= LVIV_BOUNDS.maxLng;
