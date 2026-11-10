import { mulberry32 } from "./jitter.js";
import { findDistrictId } from "./districtLookup.js";
import { normalizeVector } from "../services/embeddingService.js";

// Pure helpers for the synthetic load-test set (NFR-01/02): clones of real
// labelled reports with a slightly perturbed vector and a random point inside
// a Lviv district. The set measures speed only, never accuracy.

const MAX_POINT_ATTEMPTS = 2000;
const STATUS_MIX = [
  ["new", 0.6],
  ["in_progress", 0.2],
  ["resolved", 0.15],
  ["cancelled", 0.05],
];

// Standard normal number from two uniform ones (Box-Muller).
const gaussian = (random) => {
  const u = Math.max(random(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
};

// Adds Gaussian noise (sigma per dimension) and renormalizes to unit length.
// For 768 dimensions sigma 0.02 keeps the cosine to the original near 0.87.
export const perturbVector = (vector, random, sigma = 0.02) =>
  normalizeVector(vector.map((value) => value + sigma * gaussian(random)));

const collectCoordinates = (geometry) =>
  geometry.type === "Polygon"
    ? geometry.coordinates.flat()
    : geometry.coordinates.flat(2);

export const featuresBounds = (features) => {
  const points = features.flatMap((f) => collectCoordinates(f.geometry));
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  return {
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
};

// Random point uniformly inside the union of district polygons.
export const randomPointInDistricts = (features, random, bounds) => {
  const box = bounds ?? featuresBounds(features);
  for (let attempt = 0; attempt < MAX_POINT_ATTEMPTS; attempt += 1) {
    const lat = box.minLat + random() * (box.maxLat - box.minLat);
    const lng = box.minLng + random() * (box.maxLng - box.minLng);
    const districtId = findDistrictId(lat, lng, features);
    if (districtId) return { lat, lng, district_id: districtId };
  }
  throw new Error("Could not find a point inside the district polygons");
};

const pickStatus = (random) => {
  let roll = random();
  for (const [status, share] of STATUS_MIX) {
    if (roll < share) return status;
    roll -= share;
  }
  return "new";
};

// source: a stored report with title, description, location, type_id,
// priority_id and embedding. Same index always gives the same clone.
export const buildClone = ({
  source,
  index,
  features,
  authorId,
  bounds,
  sigma = 0.02,
  now = Date.now(),
}) => {
  const random = mulberry32(index + 1);
  const point = randomPointInDistricts(features, random, bounds);
  const ageDays = random() * 90;

  return {
    title: source.title,
    description: source.description,
    location: source.location,
    district_id: point.district_id,
    geo: { type: "Point", coordinates: [point.lng, point.lat] },
    type_id: source.type_id,
    priority_id: source.priority_id,
    status_id: pickStatus(random),
    embedding: perturbVector(source.embedding, random, sigma),
    embedding_model: source.embedding_model,
    created_by: authorId,
    modified_by: authorId,
    created_dt: new Date(now - ageDays * 24 * 3600 * 1000),
  };
};
