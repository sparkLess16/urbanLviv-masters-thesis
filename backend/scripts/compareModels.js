// Compares two embedding models on the labelled evaluation set (research part,
// question Q10). Model A is the stored vector (gemini-embedding-001); model B
// is embedded here (gemini-embedding-2) and cached, so a rerun costs nothing.
// All metrics are computed in memory: nothing is written to Atlas.
//
// Metrics per model, on the tune and test halves of the set:
//   Precision@5   text only (alpha 1), geo only (alpha 0), hybrid (alpha 0.8 and
//                 the alpha chosen on tune)
//   Pair F1       "same problem" classification within 500 m, threshold chosen
//                 on tune and applied to test
//   Separation    mean cosine of same-group pairs minus different-group pairs
//
// Usage (from the backend directory):
//   npm run compare:models                # embeds missing vectors, then compares
//   npm run compare:models -- --no-embed  # use only what is cached (fails if missing)
import crypto from "node:crypto";
import fs from "node:fs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import {
  buildEmbeddingText,
  embedTexts,
  EMBEDDING_DIMENSIONS,
} from "../src/services/embeddingService.js";
import { loadSplitMap } from "../src/utils/evalSplit.js";
import {
  bestThreshold,
  buildPairs,
  f1At,
  precisionAtK,
  semanticGap,
} from "../src/utils/modelComparison.js";

dotenv.config();

const DB_NAME = process.env.EXPERIMENT_DB_NAME || "urbanlviv_experiments";
const MODEL_B = "gemini-embedding-2";
const MODEL_A = "gemini-embedding-001";
const FIXED_ALPHA = 0.8;
const REQUEST_DELAY_MS = 700;

const CACHE_DIR = new URL("../data/cache/", import.meta.url);
const CACHE_FILE = new URL("embeddings_model_b.json", CACHE_DIR);
const RESULT_FILE = new URL("../data/results/ev_models.json", import.meta.url);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cacheKey = (text) =>
  crypto
    .createHash("sha1")
    .update(`${MODEL_B}|${EMBEDDING_DIMENSIONS}|${text}`)
    .digest("hex");

const loadModelBVectors = async (texts) => {
  const cache = fs.existsSync(CACHE_FILE)
    ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"))
    : {};
  const missing = [...new Set(texts)].filter((t) => !cache[cacheKey(t)]);
  console.log(
    `${texts.length} text(s): ${texts.length - missing.length} cached, ${missing.length} to embed with ${MODEL_B}`,
  );
  if (missing.length > 0 && process.argv.includes("--no-embed")) {
    throw new Error("Vectors are missing and --no-embed was given");
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  // One text per request: gemini-embedding-2 merges a list of texts into a
  // single vector, unlike gemini-embedding-001.
  for (let i = 0; i < missing.length; i += 1) {
    const [vector] = await embedTexts([missing[i]], "document", {
      model: MODEL_B,
    });
    cache[cacheKey(missing[i])] = vector;
    // Save regularly so an interrupted run keeps its progress.
    if ((i + 1) % 10 === 0 || i + 1 === missing.length) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
      console.log(`  ✓ embedded ${i + 1}/${missing.length}`);
    }
    await sleep(REQUEST_DELAY_MS);
  }
  return (text) => cache[cacheKey(text)];
};

const evaluateModel = (items) => {
  const queriesOf = (split) => items.filter((item) => item.split === split);
  const p5 = (split, alpha) => precisionAtK(queriesOf(split), items, { alpha });

  // alpha chosen on tune only
  let bestAlpha = { alpha: 0, value: -1 };
  for (let a = 0; a <= 10; a += 1) {
    const alpha = a / 10;
    const value = p5("tune", alpha);
    if (value > bestAlpha.value) bestAlpha = { alpha, value };
  }

  const pairsTune = buildPairs(items, "tune");
  const pairsTest = buildPairs(items, "test");
  const threshold = bestThreshold(pairsTune);

  return {
    precision_at_5: {
      text_only: { tune: p5("tune", 1), test: p5("test", 1) },
      geo_only: { tune: p5("tune", 0), test: p5("test", 0) },
      hybrid_fixed: {
        alpha: FIXED_ALPHA,
        tune: p5("tune", FIXED_ALPHA),
        test: p5("test", FIXED_ALPHA),
      },
      hybrid_tuned: {
        alpha: bestAlpha.alpha,
        tune: bestAlpha.value,
        test: p5("test", bestAlpha.alpha),
      },
    },
    pair_classification: {
      threshold: threshold.threshold,
      tune: f1At(pairsTune, threshold.threshold),
      test: f1At(pairsTest, threshold.threshold),
    },
    separation: semanticGap(items),
  };
};

const fmt = (value) => (Number.isFinite(value) ? value.toFixed(3) : "n/a");

const printTable = (results) => {
  const rows = [
    ["P@5 text only (a=1)", (r) => r.precision_at_5.text_only],
    ["P@5 geo only (a=0)", (r) => r.precision_at_5.geo_only],
    [`P@5 hybrid a=${FIXED_ALPHA}`, (r) => r.precision_at_5.hybrid_fixed],
    ["P@5 hybrid tuned", (r) => r.precision_at_5.hybrid_tuned],
  ];
  console.log("\nmetric                    model            tune   test");
  for (const [label, pick] of rows) {
    for (const [name, r] of Object.entries(results)) {
      const v = pick(r);
      console.log(
        `${label.padEnd(25)} ${name.padEnd(18)} ${fmt(v.tune)}  ${fmt(v.test)}` +
          (v.alpha !== undefined ? `  (alpha ${v.alpha})` : ""),
      );
    }
  }
  console.log("\npair F1 (threshold from tune)   tune   test   threshold");
  for (const [name, r] of Object.entries(results)) {
    const p = r.pair_classification;
    console.log(
      `${name.padEnd(30)} ${fmt(p.tune.f1)}  ${fmt(p.test.f1)}  ${p.threshold}`,
    );
  }
  console.log("\nseparation (same - different group)   same   diff   gap");
  for (const [name, r] of Object.entries(results)) {
    const s = r.separation;
    console.log(
      `${name.padEnd(36)} ${fmt(s.same)}  ${fmt(s.different)}  ${fmt(s.gap)}`,
    );
  }
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB_NAME });
  const db = mongoose.connection;
  console.log(`Database: ${db.name} (read only)`);

  const labels = await db.collection("eval_labels").find().toArray();
  const groupOf = new Map(labels.map((l) => [String(l.report_id), l.group_id]));
  const splitOf = loadSplitMap();
  const docs = await db
    .collection("reports")
    .find({
      _id: { $in: labels.map((l) => l.report_id) },
      embedding: { $exists: true },
      geo: { $exists: true },
    })
    .toArray();
  console.log(`${docs.length} labelled report(s) with vectors and coordinates`);
  await mongoose.disconnect();

  const textOf = (doc) => buildEmbeddingText(doc);
  const vectorB = await loadModelBVectors(docs.map(textOf));

  const base = docs.map((doc) => {
    const group = groupOf.get(String(doc._id));
    return {
      id: String(doc._id),
      group,
      split: splitOf.get(group),
      geo: doc.geo,
      vectorA: doc.embedding,
      vectorB: vectorB(textOf(doc)),
    };
  });

  const results = {
    [MODEL_A]: evaluateModel(base.map((b) => ({ ...b, vector: b.vectorA }))),
    [MODEL_B]: evaluateModel(base.map((b) => ({ ...b, vector: b.vectorB }))),
  };
  printTable(results);

  fs.mkdirSync(new URL("../data/results/", import.meta.url), {
    recursive: true,
  });
  fs.writeFileSync(
    RESULT_FILE,
    JSON.stringify({ reports: base.length, results }, null, 2),
  );
  console.log("\nSaved to data/results/ev_models.json");
};

run().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});
