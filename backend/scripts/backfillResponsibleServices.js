// Fills responsible_service on existing clusters from the current config.
// Clusters with a manual override are left alone. Makes no Gemini requests.
//
// Usage (from the backend directory):
//   npm run backfill:services                  # main database
//   npm run backfill:services -- --experiment  # experiment database
//   npm run backfill:services -- --dry-run     # count only, write nothing
import dotenv from "dotenv";
import mongoose from "mongoose";
import ReportCluster from "../src/models/ReportCluster.js";
import { resolveResponsibleService } from "../src/config/responsibleServices.js";

dotenv.config();

const has = (flag) => process.argv.includes(flag);

const run = async () => {
  const options = has("--experiment")
    ? { dbName: process.env.EXPERIMENT_DB_NAME || "urbanlviv_experiments" }
    : {};
  await mongoose.connect(process.env.MONGO_URI, options);
  console.log(`Database: ${mongoose.connection.name}`);

  const clusters = await ReportCluster.find({
    responsible_service_manual: { $ne: true },
  }).select("type_id district_id responsible_service");

  let changed = 0;
  for (const cluster of clusters) {
    const service = resolveResponsibleService(cluster);
    if (cluster.responsible_service === service) continue;
    changed += 1;
    if (!has("--dry-run")) {
      await ReportCluster.updateOne(
        { _id: cluster._id },
        { responsible_service: service },
        { timestamps: false },
      );
    }
  }
  console.log(
    `${clusters.length} cluster(s) checked, ${changed} ${has("--dry-run") ? "to update" : "updated"}`,
  );
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
