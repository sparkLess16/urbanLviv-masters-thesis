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

// Haversine distance in meters between two { lat, lng } points.
export const distanceMeters = (a, b) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
};
