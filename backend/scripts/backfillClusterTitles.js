// Sets representative_report_id on existing clusters by rebuilding each one
// from its members (status and service are refreshed the same way).
// Makes no Gemini requests.
//
// Usage (from the backend directory):
//   npm run backfill:cluster-titles                  # main database
//   npm run backfill:cluster-titles -- --experiment  # experiment database
//   npm run backfill:cluster-titles -- --dry-run     # count only, write nothing
import dotenv from "dotenv";
import mongoose from "mongoose";
import ReportCluster from "../src/models/ReportCluster.js";
import { recomputeCluster } from "../src/services/clusteringService.js";

dotenv.config();

const has = (flag) => process.argv.includes(flag);

const run = async () => {
  const options = has("--experiment")
    ? { dbName: process.env.EXPERIMENT_DB_NAME || "urbanlviv_experiments" }
    : {};
  await mongoose.connect(process.env.MONGO_URI, options);
  console.log(`Database: ${mongoose.connection.name}`);

  const missing = await ReportCluster.find({
    representative_report_id: null,
  }).select("_id");

  if (!has("--dry-run")) {
    for (const cluster of missing) await recomputeCluster(cluster._id);
  }
  console.log(
    `${missing.length} cluster(s) without a title, ${has("--dry-run") ? "to update" : "updated"}`,
  );
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
