// Picks alpha of the similar-report formula (FR-01) on the evaluation set.
// Every labelled report is a query; all other labelled reports are ranked by
// alpha * semantic + (1 - alpha) * spatial using the stored vectors, entirely
// in memory (no Atlas search, no Gemini). Precision@5 counts results from the
// same ground-truth group. Same ranking as geo-first search without the
// radius cut-off, so it is a fast way to compare alpha values.
//
// Usage (from the backend directory):
//   npm run eval:alpha                       # all groups
//   npm run eval:alpha -- --split tune       # or test
import dotenv from "dotenv";
import mongoose from "mongoose";
import Report from "../src/models/Report.js";
import { DEFAULTS } from "../src/services/similarityService.js";
import { filterBySplit } from "../src/utils/evalSplit.js";
import { geoToLatLng } from "../src/utils/geo.js";
import {
  combineScores,
  distanceMeters,
  dotProduct,
  spatialScore,
} from "../src/utils/geoMath.js";

dotenv.config();

const DB_NAME = process.env.EXPERIMENT_DB_NAME || "urbanlviv_experiments";
const K = 5;
const ALPHAS = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.3, 0];

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB_NAME });
  const labels = await mongoose.connection
    .collection("eval_labels")
    .find()
    .toArray();
  const groupOf = new Map(labels.map((l) => [String(l.report_id), l.group_id]));
  const docs = await Report.find({ _id: { $in: [...groupOf.keys()] } })
    .select("+embedding")
    .lean();
  const all = docs.map((doc) => ({
    id: String(doc._id),
    doc,
    point: geoToLatLng(doc.geo),
    embedding: doc.embedding,
  }));
  await mongoose.disconnect();

  const split = arg("split", "all");
  const queries = filterBySplit(
    all.map((item) => item.doc),
    groupOf,
    split,
  ).map((doc) => all.find((item) => item.id === String(doc._id)));
  const radiusM = Number(arg("radius", DEFAULTS.radiusM));
  console.log(
    `${queries.length} queries (${split}) against ${all.length} reports, radius ${radiusM} m`,
  );
  console.log("alpha   Precision@5");

  for (const alpha of ALPHAS) {
    let sum = 0;
    for (const query of queries) {
      const ranked = all
        .filter((item) => item.id !== query.id)
        .map((item) => ({
          id: item.id,
          score: combineScores(
            Math.max(0, dotProduct(query.embedding, item.embedding)),
            spatialScore(distanceMeters(query.point, item.point), radiusM),
            alpha,
          ),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, K);
      const group = groupOf.get(query.id);
      sum += ranked.filter((item) => groupOf.get(item.id) === group).length / K;
    }
    console.log(
      `${String(alpha).padEnd(7)} ${(sum / queries.length).toFixed(3)}`,
    );
  }
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
