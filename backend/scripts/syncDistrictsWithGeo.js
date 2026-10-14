// One-time script: finds the Lviv district of each geocoded report's point
// (Nominatim reverse geocoding) and fixes district_id where it disagrees.
//
// Usage (from the backend directory):
//   npm run sync:districts            # dry run: only print mismatches
//   npm run sync:districts -- --apply # write the corrected district_id
import dotenv from "dotenv";
import mongoose from "mongoose";
import Report from "../src/models/Report.js";
import { geoToLatLng } from "../src/utils/geo.js";

dotenv.config();

const APPLY = process.argv.includes("--apply");
const REQUEST_DELAY_MS = 1100;
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

const DISTRICTS_BY_UK_NAME = {
  Галицький: "halytskyi",
  Франківський: "frankivskyi",
  Личаківський: "lychakivskyi",
  Сихівський: "sykhivskyi",
  Шевченківський: "shevchenkivskyi",
  Залізничний: "zaliznychnyi",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const findDistrictId = async ({ lat, lng }) => {
  const params = new URLSearchParams({
    lat,
    lon: lng,
    format: "json",
    addressdetails: "1",
    "accept-language": "uk",
  });

  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { "User-Agent": "UrbanLviv-diploma-geocoder/1.0" },
  });
  if (!response.ok) {
    throw new Error(`Nominatim responded with ${response.status}`);
  }

  const { address = {} } = await response.json();
  const candidates = [
    address.city_district,
    address.suburb,
    address.borough,
    address.district,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const match = Object.keys(DISTRICTS_BY_UK_NAME).find((name) =>
      candidate.includes(name),
    );
    if (match) return DISTRICTS_BY_UK_NAME[match];
  }
  return null;
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const reports = await Report.find({ geo: { $exists: true } });
  console.log(
    `${reports.length} report(s) with coordinates${APPLY ? "" : " (dry run)"}`,
  );

  let mismatched = 0;
  let unknown = 0;

  for (const report of reports) {
    try {
      const point = geoToLatLng(report.geo);
      const actual = await findDistrictId(point);
      await sleep(REQUEST_DELAY_MS);

      const label = `${report._id} "${report.location}"`;

      if (!actual) {
        unknown += 1;
        console.log(`  ? ${label} — district not recognised, left as is`);
      } else if (actual === report.district_id) {
        console.log(`  = ${label} — ${actual}`);
      } else {
        mismatched += 1;
        console.log(`  ≠ ${label} — ${report.district_id} → ${actual}`);
        if (APPLY) {
          // timestamps: false keeps modified_dt unchanged.
          await Report.updateOne(
            { _id: report._id },
            { $set: { district_id: actual } },
            { timestamps: false },
          );
        }
      }
    } catch (error) {
      console.log(`  ✗ ${report._id} — ${error.message}`);
    }
  }

  console.log(
    `\nDone: ${mismatched} mismatched${APPLY ? " and fixed" : ""}, ${unknown} unrecognised.`,
  );
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
