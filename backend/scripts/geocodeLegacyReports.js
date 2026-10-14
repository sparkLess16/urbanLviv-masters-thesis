// One-time script: geocodes the text addresses of reports created before geo
// support and stores the result in report.geo.
//
// Usage (from the backend directory):
//   npm run geocode:legacy -- --dry-run   # print results, write nothing
//   npm run geocode:legacy                # write coordinates to MongoDB
//
// Uses OpenStreetMap Nominatim (no API key). Its usage policy allows at most
// one request per second and requires an identifying User-Agent.
import dotenv from "dotenv";
import mongoose from "mongoose";
import Report from "../src/models/Report.js";
import { buildGeoPoint, LVIV_BOUNDS } from "../src/utils/geo.js";

dotenv.config();

const DRY_RUN = process.argv.includes("--dry-run");
const REQUEST_DELAY_MS = 1100;
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

const DISTRICT_NAMES = {
  halytskyi: "Halytskyi",
  frankivskyi: "Frankivskyi",
  lychakivskyi: "Lychakivskyi",
  sykhivskyi: "Sykhivskyi",
  shevchenkivskyi: "Shevchenkivskyi",
  zaliznychnyi: "Zaliznychnyi",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const geocode = async (query) => {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "1",
    // Restrict results to the Lviv bounding box.
    viewbox: `${LVIV_BOUNDS.minLng},${LVIV_BOUNDS.maxLat},${LVIV_BOUNDS.maxLng},${LVIV_BOUNDS.minLat}`,
    bounded: "1",
  });

  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { "User-Agent": "UrbanLviv-diploma-geocoder/1.0" },
  });

  if (!response.ok) {
    throw new Error(`Nominatim responded with ${response.status}`);
  }

  const results = await response.json();
  return results[0] ? { lat: results[0].lat, lng: results[0].lon } : null;
};

// Free-text locations often carry descriptive tails ("..., near bus stop").
// Try the full text first, then each fragment on its own (e.g. just the street).
const buildQueries = (report) => {
  const district = DISTRICT_NAMES[report.district_id];
  const fragments = report.location
    .split(/,|near/i)
    .map((part) => part.trim())
    .filter(Boolean);

  const queries = [
    `${report.location}, ${district ? `${district} district, ` : ""}Lviv, Ukraine`,
    `${report.location}, Lviv, Ukraine`,
    ...fragments.map((fragment) => `${fragment}, Lviv, Ukraine`),
  ];
  return [...new Set(queries)];
};

const geocodeReport = async (report) => {
  for (const query of buildQueries(report)) {
    const point = await geocode(query);
    await sleep(REQUEST_DELAY_MS);
    if (point) return point;
  }
  return null;
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const reports = await Report.find({ geo: { $exists: false } });
  console.log(
    `${reports.length} report(s) without coordinates${DRY_RUN ? " (dry run)" : ""}`,
  );

  let updated = 0;
  const failed = [];

  for (const report of reports) {
    try {
      const point = await geocodeReport(report);
      const { geo } = point ? buildGeoPoint(point.lat, point.lng) : {};

      if (!geo) {
        failed.push(report);
        console.log(`  ✗ ${report._id} "${report.location}" — not found`);
        continue;
      }

      console.log(
        `  ✓ ${report._id} "${report.location}" → ${geo.coordinates[1]}, ${geo.coordinates[0]}`,
      );

      if (!DRY_RUN) {
        // timestamps: false keeps modified_dt unchanged.
        await Report.updateOne(
          { _id: report._id },
          { $set: { geo } },
          { timestamps: false },
        );
      }
      updated += 1;
    } catch (error) {
      failed.push(report);
      console.log(`  ✗ ${report._id} "${report.location}" — ${error.message}`);
    }
  }

  console.log(`\nDone: ${updated} geocoded, ${failed.length} failed.`);
  if (failed.length > 0) {
    console.log("Failed reports need coordinates set manually (edit the report).");
  }

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
