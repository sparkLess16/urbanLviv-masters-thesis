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

// Linear spatial score: 1 at distance 0, falling to 0 at radiusM and beyond.
// Unknown distance (a report without coordinates) scores 0.
export const spatialScore = (distance, radiusM) => {
  if (distance === null || distance === undefined) return 0;
  return Math.max(0, 1 - distance / radiusM);
};

// Atlas reports cosine similarity as (1 + cos) / 2. Convert back to cosine and
// clamp to 0..1 so semantic and spatial scores share one scale.
export const atlasScoreToCosine = (atlasScore) =>
  Math.min(1, Math.max(0, 2 * atlasScore - 1));

// Dot product of two vectors. For unit vectors (ours are normalized) this is
// the cosine similarity.
export const dotProduct = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
};

// score = alpha * semantic + (1 - alpha) * spatial
export const combineScores = (semantic, spatial, alpha) =>
  alpha * semantic + (1 - alpha) * spatial;
