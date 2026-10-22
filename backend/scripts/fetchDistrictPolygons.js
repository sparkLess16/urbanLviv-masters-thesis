// One-time script: downloads the 6 Lviv district boundaries from OpenStreetMap
// (Nominatim search with polygon_geojson) into data/lviv_districts.geojson.
// Data: © OpenStreetMap contributors, ODbL.
//
// Usage (from the backend directory):
//   npm run fetch:districts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DISTRICTS } from "../src/utils/districts.js";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const REQUEST_DELAY_MS = 1100;
const OUTPUT_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data/lviv_districts.geojson",
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchPolygon = async (district) => {
  const params = new URLSearchParams({
    q: `${district.ukName} район, Львів`,
    format: "jsonv2",
    polygon_geojson: "1",
    limit: "5",
    "accept-language": "uk",
  });
  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { "User-Agent": "UrbanLviv-diploma-geocoder/1.0" },
  });
  if (!response.ok) {
    throw new Error(`Nominatim responded with ${response.status}`);
  }

  const results = await response.json();
  const match = results.find(
    (item) =>
      item.category === "boundary" &&
      ["Polygon", "MultiPolygon"].includes(item.geojson?.type) &&
      item.display_name.includes(district.ukName),
  );
  if (!match) throw new Error(`No boundary polygon for ${district.id}`);
  return match;
};

const run = async () => {
  const features = [];

  for (const district of DISTRICTS) {
    const match = await fetchPolygon(district);
    console.log(`  ✓ ${district.id} — ${match.display_name}`);
    features.push({
      type: "Feature",
      properties: {
        district_id: district.id,
        name: district.name,
        osm_id: match.osm_id,
      },
      geometry: match.geojson,
    });
    await sleep(REQUEST_DELAY_MS);
  }

  if (features.length !== DISTRICTS.length) {
    throw new Error(
      `Expected ${DISTRICTS.length} polygons, got ${features.length}`,
    );
  }

  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(
    OUTPUT_FILE,
    JSON.stringify({ type: "FeatureCollection", features }),
  );
  console.log(`\nSaved ${features.length} polygons to ${OUTPUT_FILE}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
