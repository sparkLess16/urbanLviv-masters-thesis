const METERS_PER_DEGREE_LAT = 111320;

// 32-bit string hash and a small seeded PRNG: the same seed always gives the
// same offset, so reloading the dataset reproduces identical coordinates.
export const hashString = (text) => {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const mulberry32 = (seed) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Shifts a point by a random distance (minMeters..maxMeters) in a random direction.
export const jitterPoint = (lat, lng, seed, minMeters = 5, maxMeters = 30) => {
  const random = mulberry32(hashString(seed));
  const distance = minMeters + random() * (maxMeters - minMeters);
  const angle = random() * 2 * Math.PI;
  const dLat = (distance * Math.cos(angle)) / METERS_PER_DEGREE_LAT;
  const dLng =
    (distance * Math.sin(angle)) /
    (METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
};
