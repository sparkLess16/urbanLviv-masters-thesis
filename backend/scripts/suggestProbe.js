// Manual check of the report-form hints (read only): runs the same function as
// POST /api/reports/suggest for a text and a point and prints the result.
//
// Usage (from the backend directory):
//   npm run suggest:probe -- --experiment --lat 49.83 --lng 24.04 "text of the report"
//
// Costs one Gemini embedding call only when reports exist near the point.
import dotenv from "dotenv";
import mongoose from "mongoose";
import { suggestSimilar } from "../src/services/suggestService.js";

dotenv.config();

const args = process.argv.slice(2);
const EXPERIMENT = args.includes("--experiment");
const DB_NAME = process.env.EXPERIMENT_DB_NAME || "urbanlviv_experiments";

const readOption = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const lat = Number(readOption("--lat"));
const lng = Number(readOption("--lng"));
const optionValues = new Set([readOption("--lat"), readOption("--lng")]);
const text = args
  .filter((arg) => !arg.startsWith("--") && !optionValues.has(arg))
  .join(" ")
  .trim();

const run = async () => {
  if (!text || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    console.log(
      'Usage: npm run suggest:probe -- [--experiment] --lat 49.83 --lng 24.04 "text"',
    );
    return;
  }

  await mongoose.connect(
    process.env.MONGO_URI,
    EXPERIMENT ? { dbName: DB_NAME } : {},
  );
  console.log(`Database: ${mongoose.connection.name}`);

  // A random user id: nobody's own reports are excluded.
  const userId = new mongoose.Types.ObjectId();
  const result = await suggestSimilar({
    title: "",
    description: text,
    point: { lat, lng },
    userId,
  });

  console.log(result.reason ? `Reason: ${result.reason}` : "Hints found:");
  for (const item of result.items) {
    console.log(
      `  ${String(item.match_percent).padStart(3)}%  ${String(item.distance_m).padStart(4)} m  strong=${item.strong_match}  [${item.type_id}]  ${item.title}`,
    );
  }
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
