// Looks up coordinates for the group addresses of the evaluation set and
// stores them in data/eval/address_coords.json (a cache, committed to git so
// the dataset can be rebuilt offline).
//
// Usage (from the backend directory):
//   npm run geocode:dataset
//
// Uses OpenStreetMap Nominatim: at most one request per second and an
// identifying User-Agent. Falls back to the bare street when the exact house
// number is unknown and marks such entries with "fallback": true.
import fs from "node:fs";
import { LVIV_BOUNDS, isWithinLviv } from "../src/utils/geo.js";

const DATA_FILE = new URL("../data/eval/eval_set.json", import.meta.url);
const CACHE_FILE = new URL("../data/eval/address_coords.json", import.meta.url);
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const REQUEST_DELAY_MS = 1100;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const search = async (query) => {
  const params = new URLSearchParams({
    q: `${query}, Lviv, Ukraine`,
    format: "json",
    limit: "1",
    viewbox: `${LVIV_BOUNDS.minLng},${LVIV_BOUNDS.maxLat},${LVIV_BOUNDS.maxLng},${LVIV_BOUNDS.minLat}`,
    bounded: "1",
  });
  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { "User-Agent": "UrbanLviv-diploma-geocoder/1.0" },
  });
  if (!response.ok) {
    throw new Error(`Nominatim responded with ${response.status}`);
  }
  const [hit] = await response.json();
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  return isWithinLviv(lat, lng)
    ? { lat, lng, matched: hit.display_name }
    : null;
};

const run = async () => {
  const { groups } = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const cache = fs.existsSync(CACHE_FILE)
    ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"))
    : {};

  const missing = new Map(
    groups.filter((g) => !cache[g.address]).map((g) => [g.address, g.street]),
  );
  console.log(`${missing.size} address(es) to look up`);

  for (const [address, street] of missing) {
    let result = await search(address);
    await sleep(REQUEST_DELAY_MS);
    let fallback = false;

    if (!result) {
      result = await search(street);
      await sleep(REQUEST_DELAY_MS);
      fallback = true;
    }

    if (!result) {
      console.log(`  ✗ ${address}: not found`);
      continue;
    }

    cache[address] = { ...result, fallback };
    console.log(
      `  ${fallback ? "~" : "✓"} ${address} → ${result.lat}, ${result.lng}${fallback ? " (street only)" : ""}\n      ${result.matched}`,
    );
  }

  fs.writeFileSync(CACHE_FILE, `${JSON.stringify(cache, null, 2)}\n`);
  const unresolved = groups.filter((g) => !cache[g.address]);
  console.log(`\nDone: ${unresolved.length} unresolved.`);
  if (unresolved.length > 0) process.exit(1);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
