// Builds the synthetic LOAD-TEST set for NFR-01/02 in its own database. It
// clones the labelled reports of the experiment database: same text, vector
// with small random noise, random point inside a Lviv district. Makes NO
// Gemini requests. The set measures speed only, never accuracy.
//
// Usage (from the backend directory):
//   npm run seed:load -- --dry-run          # reads the source, writes nothing
//   npm run seed:load                       # 10 000 clones into an empty load database
//   npm run seed:load -- --reset --count 5000
//
// Source database: EXPERIMENT_DB_NAME (default urbanlviv_experiments).
// Target database: LOAD_DB_NAME (default urbanlviv_experiments_load). The
// target name must contain "experiment" so --reset can never wipe the working
// database.
import crypto from "node:crypto";
import fs from "node:fs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Report from "../src/models/Report.js";
import User from "../src/models/User.js";
import { buildClone, featuresBounds } from "../src/utils/loadDataset.js";

dotenv.config();

const has = (flag) => process.argv.includes(flag);
const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const SOURCE_DB = process.env.EXPERIMENT_DB_NAME || "urbanlviv_experiments";
const TARGET_DB = process.env.LOAD_DB_NAME || "urbanlviv_experiments_load";
const COUNT = Number(arg("count", 10000));
const SIGMA = Number(arg("sigma", 0.02));
const BATCH = 500;

const FEATURES = JSON.parse(
  fs.readFileSync(
    new URL("../data/lviv_districts.geojson", import.meta.url),
    "utf8",
  ),
).features;

const readSources = async () => {
  const connection = await mongoose
    .createConnection(process.env.MONGO_URI, { dbName: SOURCE_DB })
    .asPromise();
  const labels = await connection
    .collection("eval_labels")
    .find()
    .project({ report_id: 1 })
    .toArray();
  const sources = await connection
    .collection("reports")
    .find({
      _id: { $in: labels.map((l) => l.report_id) },
      embedding: { $exists: true },
    })
    .toArray();
  await connection.close();
  return sources;
};

const run = async () => {
  if (!TARGET_DB.includes("experiment") || TARGET_DB === SOURCE_DB) {
    throw new Error(
      `LOAD_DB_NAME must contain "experiment" and differ from the source (got "${TARGET_DB}")`,
    );
  }

  const sources = await readSources();
  console.log(
    `Source "${SOURCE_DB}": ${sources.length} labelled report(s) with vectors`,
  );
  if (sources.length === 0) throw new Error("No source reports found");
  console.log(`Target "${TARGET_DB}": ${COUNT} clone(s), sigma ${SIGMA}`);

  if (has("--dry-run")) {
    console.log("Dry run: nothing was written.");
    return;
  }

  await mongoose.connect(process.env.MONGO_URI, { dbName: TARGET_DB });
  const existing = await Report.countDocuments();
  if (existing > 0 && !has("--reset")) {
    throw new Error(
      `${existing} report(s) already in "${TARGET_DB}". Use --reset to reload.`,
    );
  }
  if (has("--reset")) {
    await Promise.all([Report.deleteMany({}), User.deleteMany({})]);
    console.log("Load database wiped.");
  }

  const author = await User.create({
    name: "Load Seed",
    email: "load@example.test",
    password: crypto.randomBytes(32).toString("hex"),
    isVerified: true,
  });

  const bounds = featuresBounds(FEATURES);
  for (let start = 0; start < COUNT; start += BATCH) {
    const documents = [];
    for (let i = start; i < Math.min(start + BATCH, COUNT); i += 1) {
      documents.push(
        buildClone({
          source: sources[i % sources.length],
          index: i,
          features: FEATURES,
          authorId: author._id,
          bounds,
          sigma: SIGMA,
        }),
      );
    }
    await Report.insertMany(documents, { ordered: false });
    console.log(`  ✓ inserted ${Math.min(start + BATCH, COUNT)}/${COUNT}`);
  }

  await Report.createIndexes();
  console.log("Done. Next: create the vector index for this database.");
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
