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

// Reports at (almost) the same spot would hide each other on the map: spread
// each such group on a small circle around the spot. Display only; stored
// coordinates stay as they are. Returns a Map from item to { lat, lng }.
export const fanOutOverlapping = (items, getPoint, radiusM = 14) => {
  const groups = new Map();
  items.forEach((item) => {
    const { lat, lng } = getPoint(item);
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });

  const result = new Map();
  groups.forEach((group) => {
    group.forEach((item, index) => {
      const point = getPoint(item);
      if (group.length === 1) {
        result.set(item, point);
        return;
      }
      const angle = (2 * Math.PI * index) / group.length;
      const metersPerDegree = 111320;
      result.set(item, {
        lat: point.lat + (radiusM * Math.sin(angle)) / metersPerDegree,
        lng:
          point.lng +
          (radiusM * Math.cos(angle)) /
            (metersPerDegree * Math.cos((point.lat * Math.PI) / 180)),
      });
    });
  });
  return result;
};

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
