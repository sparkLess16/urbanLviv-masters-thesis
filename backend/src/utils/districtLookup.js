import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const POLYGONS_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../data/lviv_districts.geojson",
);

let cachedFeatures = null;

const loadFeatures = () => {
  if (!cachedFeatures) {
    cachedFeatures = JSON.parse(readFileSync(POLYGONS_FILE, "utf8")).features;
  }
  return cachedFeatures;
};

// Ray casting on one linear ring of [lng, lat] pairs.
const isInRing = (lng, lat, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
};

// A polygon is an outer ring followed by holes.
const isInPolygon = (lng, lat, [outer, ...holes]) =>
  isInRing(lng, lat, outer) && !holes.some((hole) => isInRing(lng, lat, hole));

const isInGeometry = (lng, lat, { type, coordinates }) =>
  type === "Polygon"
    ? isInPolygon(lng, lat, coordinates)
    : coordinates.some((polygon) => isInPolygon(lng, lat, polygon));

// Returns the district_id whose polygon contains the point, or null.
// `features` is injectable for tests.
export const findDistrictId = (lat, lng, features = loadFeatures()) =>
  features.find((feature) => isInGeometry(lng, lat, feature.geometry))
    ?.properties.district_id ?? null;
