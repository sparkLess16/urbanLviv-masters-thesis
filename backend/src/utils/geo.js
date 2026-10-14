// Approximate bounding box of Lviv; points outside are rejected.
export const LVIV_BOUNDS = {
  minLat: 49.77,
  maxLat: 49.92,
  minLng: 23.89,
  maxLng: 24.14,
};

export const isWithinLviv = (lat, lng) =>
  lat >= LVIV_BOUNDS.minLat &&
  lat <= LVIV_BOUNDS.maxLat &&
  lng >= LVIV_BOUNDS.minLng &&
  lng <= LVIV_BOUNDS.maxLng;

// Converts lat/lng from the request into a GeoJSON Point ([lng, lat] order).
// Returns { geo } on success or { error } with a user-facing message.
export const buildGeoPoint = (rawLat, rawLng) => {
  if (
    rawLat === undefined ||
    rawLat === null ||
    rawLat === "" ||
    rawLng === undefined ||
    rawLng === null ||
    rawLng === ""
  ) {
    return { error: "Location coordinates (lat, lng) are required" };
  }

  const lat = Number(rawLat);
  const lng = Number(rawLng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: "Coordinates must be valid numbers" };
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: "Coordinates are out of range" };
  }

  if (!isWithinLviv(lat, lng)) {
    return { error: "Selected point is outside of Lviv" };
  }

  return { geo: { type: "Point", coordinates: [lng, lat] } };
};

// Flattens a stored GeoJSON Point into { lat, lng } for API responses.
export const geoToLatLng = (geo) => {
  const coordinates = geo?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;
  return { lat: coordinates[1], lng: coordinates[0] };
};
