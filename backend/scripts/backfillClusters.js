// Builds clusters for existing reports, oldest first so the result is the same
// on every run. Makes no Gemini requests: it uses the stored vectors.
//
// Usage (from the backend directory):
//   npm run backfill:clusters                       # only reports without a cluster
//   npm run backfill:clusters -- --reset            # drop all clusters, rebuild
//   npm run backfill:clusters -- --experiment       # use the experiment database
//   npm run backfill:clusters -- --dry-run          # count only, write nothing
//   npm run backfill:clusters -- --no-judge         # skip Gemini for borderline cases (default: on, one request per such report)
import dotenv from "dotenv";
import mongoose from "mongoose";
import Report from "../src/models/Report.js";
import ReportCluster from "../src/models/ReportCluster.js";
import { assignToCluster } from "../src/services/clusteringService.js";

dotenv.config();

const has = (flag) => process.argv.includes(flag);
if (has("--no-judge")) process.env.CLUSTER_JUDGE = "off";

const run = async () => {
  const options = has("--experiment")
    ? { dbName: process.env.EXPERIMENT_DB_NAME || "urbanlviv_experiments" }
    : {};
  await mongoose.connect(process.env.MONGO_URI, options);
  console.log(`Database: ${mongoose.connection.name}`);

  const reset = has("--reset");
  const filter = {
    status_id: { $ne: "cancelled" },
    embedding: { $exists: true },
    geo: { $exists: true },
    ...(reset ? {} : { cluster_id: null }),
  };
  const ordered = (
    await Report.find(filter).sort({ created_dt: 1 }).select("_id")
  ).map((report) => report._id);
  console.log(`${ordered.length} report(s) to cluster`);

  if (has("--dry-run")) {
    await mongoose.disconnect();
    return;
  }

  if (reset) {
    await ReportCluster.deleteMany({});
    await Report.updateMany(
      { cluster_id: { $ne: null } },
      { cluster_id: null },
      { timestamps: false },
    );
    console.log("Existing clusters removed");
  }

  for (const id of ordered) await assignToCluster(id);

  const clusters = await ReportCluster.countDocuments();
  console.log(`Done: ${clusters} cluster(s)`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
