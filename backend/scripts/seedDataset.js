// Loads the evaluation set into a SEPARATE experiment database (never the
// working one): a technical user, 70+ labelled reports with embeddings, and an
// eval_labels collection that maps each report to its ground-truth group.
//
// Usage (from the backend directory):
//   npm run seed:dataset -- --dry-run   # checks everything, writes nothing, spends no Gemini quota
//   npm run seed:dataset                # loads into an empty experiment database
//   npm run seed:dataset -- --reset     # wipes the experiment database first, then loads
//
// The database name comes from EXPERIMENT_DB_NAME (default
// urbanlviv_experiments). It must contain "experiment" so that --reset can
// never wipe the working database by mistake.
//
// Embeddings are cached in data/cache/embeddings.json (git-ignored), so a
// reload costs no Gemini requests for texts that were already embedded.
import crypto from "node:crypto";
import fs from "node:fs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Report from "../src/models/Report.js";
import User from "../src/models/User.js";
import {
  buildEmbeddingText,
  embedTexts,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
} from "../src/services/embeddingService.js";
import { validateEvalSet } from "../src/utils/datasetValidation.js";
import { jitterPoint } from "../src/utils/jitter.js";

dotenv.config();

const DRY_RUN = process.argv.includes("--dry-run");
const RESET = process.argv.includes("--reset");
const DB_NAME = process.env.EXPERIMENT_DB_NAME || "urbanlviv_experiments";

const DATA_FILE = new URL("../data/eval/eval_set.json", import.meta.url);
const COORDS_FILE = new URL(
  "../data/eval/address_coords.json",
  import.meta.url,
);
const CACHE_DIR = new URL("../data/cache/", import.meta.url);
const CACHE_FILE = new URL("embeddings.json", CACHE_DIR);

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 2000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readJson = (file, fallback) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;

const cacheKey = (text) =>
  crypto
    .createHash("sha1")
    .update(`${EMBEDDING_MODEL}|${EMBEDDING_DIMENSIONS}|${text}`)
    .digest("hex");

// Returns a Map text -> vector, calling Gemini only for texts missing in the cache.
const loadVectors = async (texts) => {
  const cache = readJson(CACHE_FILE, {});
  const missing = [...new Set(texts)].filter((t) => !cache[cacheKey(t)]);
  console.log(
    `${texts.length} text(s): ${texts.length - missing.length} cached, ${missing.length} to embed`,
  );

  if (!DRY_RUN) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      const vectors = await embedTexts(batch, "document");
      batch.forEach((text, index) => {
        cache[cacheKey(text)] = vectors[index];
      });
      // Save after every batch so an interrupted run keeps its progress.
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
      console.log(
        `  ✓ embedded ${Math.min(i + BATCH_SIZE, missing.length)}/${missing.length}`,
      );
      await sleep(BATCH_DELAY_MS);
    }
  }

  return new Map(texts.map((t) => [t, cache[cacheKey(t)]]));
};

const buildDocuments = (data, coords, vectors, authorId) => {
  const groups = new Map(data.groups.map((g) => [g.group_id, g]));

  return data.reports.map((item) => {
    const group = groups.get(item.group_id);
    const base = coords[group.address];
    const point = jitterPoint(base.lat, base.lng, item.id);
    const text = buildEmbeddingText(item);

    return {
      title: item.title,
      description: item.description,
      location: item.location,
      district_id: group.district_id,
      geo: { type: "Point", coordinates: [point.lng, point.lat] },
      type_id: group.type_id,
      priority_id: item.priority_id,
      embedding: vectors.get(text),
      embedding_model: EMBEDDING_MODEL,
      created_by: authorId,
      modified_by: authorId,
    };
  });
};

const run = async () => {
  if (!DB_NAME.includes("experiment")) {
    throw new Error(
      `EXPERIMENT_DB_NAME must contain "experiment" (got "${DB_NAME}")`,
    );
  }

  const data = readJson(DATA_FILE);
  const errors = validateEvalSet(data);
  if (errors.length > 0) {
    errors.forEach((error) => console.log(`  ✗ ${error}`));
    throw new Error("Dataset is invalid, run npm run validate:dataset");
  }

  const coords = readJson(COORDS_FILE, {});
  const noCoords = data.groups.filter((g) => !coords[g.address]);
  if (noCoords.length > 0) {
    throw new Error("Missing coordinates, run npm run geocode:dataset");
  }

  console.log(
    `Target database: ${DB_NAME}${DRY_RUN ? " (dry run)" : ""}, ${data.reports.length} report(s)`,
  );

  const texts = data.reports.map(buildEmbeddingText);
  const vectors = await loadVectors(texts);

  if (DRY_RUN) {
    console.log("Dry run: nothing was written.");
    return;
  }

  await mongoose.connect(process.env.MONGO_URI, { dbName: DB_NAME });
  const db = mongoose.connection;
  console.log(`Connected to database "${db.name}"`);

  const existing = await Report.countDocuments();
  if (existing > 0 && !RESET) {
    throw new Error(
      `${existing} report(s) already in "${db.name}". Use --reset to reload.`,
    );
  }
  if (RESET) {
    await Promise.all([
      Report.deleteMany({}),
      User.deleteMany({}),
      db.collection("eval_labels").deleteMany({}),
    ]);
    console.log("Experiment database wiped.");
  }

  // Technical author: the password is random and unknown, so nobody can log in.
  const author = await User.create({
    firstName: "Dataset",
    lastName: "Seed",
    email: "seed@example.test",
    password: crypto.randomBytes(32).toString("hex"),
    isVerified: true,
  });

  const documents = buildDocuments(data, coords, vectors, author._id);
  const inserted = await Report.insertMany(documents);

  await db.collection("eval_labels").insertMany(
    inserted.map((report, index) => ({
      report_id: report._id,
      dataset_id: data.reports[index].id,
      group_id: data.reports[index].group_id,
      style: data.reports[index].style,
    })),
  );

  console.log(`Inserted ${inserted.length} report(s) and their labels.`);
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
