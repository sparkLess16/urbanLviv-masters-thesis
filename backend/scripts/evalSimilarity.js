// Measures Precision@5 of similar-report search on the evaluation set in the
// experiment database. Every labelled report is used once as the query; a
// result counts as relevant when it belongs to the same ground-truth group.
// Uses the stored vectors, so it makes no Gemini requests.
//
// Usage (from the backend directory):
//   npm run eval:similarity                                  # defaults
//   npm run eval:similarity -- --strategy geo --alpha 0.5 --radius 300
//   npm run eval:similarity -- --sweep                       # table: strategies x alpha
import dotenv from "dotenv";
import mongoose from "mongoose";
import Report from "../src/models/Report.js";
import {
  DEFAULTS,
  findSimilarReports,
} from "../src/services/similarityService.js";
import { geoToLatLng } from "../src/utils/geo.js";

dotenv.config();

const DB_NAME = process.env.EXPERIMENT_DB_NAME || "urbanlviv_experiments";
const K = 5;

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const precisionAtK = async (queries, groupOf, options) => {
  let sum = 0;
  const perGroup = new Map();

  for (const query of queries) {
    const items = await findSimilarReports({
      ...options,
      embedding: query.embedding,
      point: geoToLatLng(query.geo),
      excludeId: query._id,
      limit: K,
    });
    const group = groupOf.get(String(query._id));
    const relevant = items.filter(
      (item) => groupOf.get(String(item.reportId)) === group,
    ).length;
    const precision = relevant / K;
    sum += precision;
    perGroup.set(group, [...(perGroup.get(group) ?? []), precision]);
  }

  return { mean: sum / queries.length, perGroup };
};

const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB_NAME });
  console.log(`Database: ${mongoose.connection.name}`);
  const indexes = await Report.collection.indexes();
  if (!indexes.some((index) => index.key.geo === "2dsphere")) {
    throw new Error("No 2dsphere index on geo; geo-first search needs it");
  }

  const labels = await mongoose.connection
    .collection("eval_labels")
    .find()
    .toArray();
  const groupOf = new Map(labels.map((l) => [String(l.report_id), l.group_id]));
  const queries = await Report.find({
    _id: { $in: [...groupOf.keys()] },
  }).select("+embedding");
  console.log(`${queries.length} labelled report(s), ${K} results each\n`);

  if (process.argv.includes("--sweep")) {
    const radiusM = Number(arg("radius", DEFAULTS.radiusM));
    console.log(`Precision@${K}, radius ${radiusM} m`);
    console.log("alpha   vector   geo");
    for (const alpha of [1, 0.9, 0.7, 0.5, 0.3]) {
      const vector = await precisionAtK(queries, groupOf, {
        strategy: "vector",
        alpha,
        radiusM,
      });
      const geo = await precisionAtK(queries, groupOf, {
        strategy: "geo",
        alpha,
        radiusM,
      });
      console.log(
        `${alpha.toFixed(1).padEnd(7)} ${vector.mean.toFixed(3).padEnd(8)} ${geo.mean.toFixed(3)}`,
      );
    }
    return;
  }

  const options = {
    strategy: arg("strategy", "vector"),
    alpha: Number(arg("alpha", DEFAULTS.alpha)),
    radiusM: Number(arg("radius", DEFAULTS.radiusM)),
  };
  const { mean: overall, perGroup } = await precisionAtK(
    queries,
    groupOf,
    options,
  );

  console.log(JSON.stringify(options));
  for (const [group, values] of [...perGroup].sort()) {
    console.log(`  ${group}  ${mean(values).toFixed(3)}`);
  }
  console.log(`\nPrecision@${K}: ${overall.toFixed(3)}`);
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
