// Asks Gemini whether borderline pairs describe the same problem and stores
// the answers in a local table (data/cache/judge_pairs.json, git-ignored).
// The table only makes the experiment cheap and repeatable; the application
// itself would ask at the moment a report arrives.
//
// A pair is borderline when both reports have the same type, lie within the
// radius and their text similarity is in the grey zone [low, high).
//
// Usage (from the backend directory):
//   npm run judge:pairs -- --split tune --dry-run   # counts pairs and requests, no Gemini call
//   npm run judge:pairs -- --split tune             # asks only for pairs not in the table yet
// Options: --low 0.80 --high 0.92 --radius 500 --model gemini-3.5-flash-lite
//          --batch 30 --max-requests 25
import fs from "node:fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Report from "../src/models/Report.js";
import { filterBySplit } from "../src/utils/evalSplit.js";
import { geoToLatLng } from "../src/utils/geo.js";
import { distanceMeters, dotProduct } from "../src/utils/geoMath.js";
import { buildJudgePrompt, pairKey } from "../src/utils/judgePrompt.js";

dotenv.config();

const DB_NAME = process.env.EXPERIMENT_DB_NAME || "urbanlviv_experiments";
const TABLE_FILE = new URL("../data/cache/judge_pairs.json", import.meta.url);
const REQUEST_DELAY_MS = 5000;

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};
const SPLIT = arg("split", "tune");
const LOW = Number(arg("low", 0.8));
const HIGH = Number(arg("high", 0.92));
const RADIUS_M = Number(arg("radius", 500));
const MODEL = arg("model", "gemini-3.5-flash-lite");
const BATCH = Number(arg("batch", 30));
const MAX_REQUESTS = Number(arg("max-requests", 25));
const DRY_RUN = process.argv.includes("--dry-run");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ask = async (ai, pairs) => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: buildJudgePrompt(pairs),
        config: { responseMimeType: "application/json", temperature: 0 },
      });
      return JSON.parse(response.text);
    } catch (error) {
      const retryable = [429, 500, 502, 503, 504].includes(error?.status);
      if (!retryable || attempt >= 3) throw error;
      await sleep(20000 * attempt);
    }
  }
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB_NAME });
  const labels = await mongoose.connection
    .collection("eval_labels")
    .find()
    .toArray();
  const groupOf = new Map(labels.map((l) => [String(l.report_id), l.group_id]));
  const datasetOf = new Map(
    labels.map((l) => [String(l.report_id), l.dataset_id]),
  );
  const all = await Report.find({ _id: { $in: [...groupOf.keys()] } })
    .select("+embedding")
    .lean();
  await mongoose.disconnect();

  const reports = filterBySplit(all, groupOf, SPLIT);
  const table = fs.existsSync(TABLE_FILE)
    ? JSON.parse(fs.readFileSync(TABLE_FILE, "utf8"))
    : { model: MODEL, pairs: {} };

  const todo = [];
  let inZone = 0;
  for (let i = 0; i < reports.length; i += 1) {
    for (let j = i + 1; j < reports.length; j += 1) {
      const a = reports[i];
      const b = reports[j];
      if (a.type_id !== b.type_id) continue;
      if (distanceMeters(geoToLatLng(a.geo), geoToLatLng(b.geo)) > RADIUS_M) {
        continue;
      }
      const cosine = dotProduct(a.embedding, b.embedding);
      if (cosine < LOW || cosine >= HIGH) continue;
      inZone += 1;
      const key = pairKey(
        datasetOf.get(String(a._id)),
        datasetOf.get(String(b._id)),
      );
      if (key in table.pairs) continue;
      todo.push({
        key,
        a,
        b,
        same: groupOf.get(String(a._id)) === groupOf.get(String(b._id)),
      });
    }
  }

  const requests = Math.ceil(todo.length / BATCH);
  console.log(
    `${SPLIT}: ${inZone} pairs in the grey zone ${LOW}-${HIGH}, ${todo.length} not in the table yet -> ${requests} request(s) of up to ${BATCH}`,
  );
  if (DRY_RUN || todo.length === 0) return;
  if (requests > MAX_REQUESTS) {
    throw new Error(`${requests} requests needed, limit is ${MAX_REQUESTS}`);
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  fs.mkdirSync(new URL("./", TABLE_FILE), { recursive: true });
  let agree = 0;
  let answered = 0;
  for (let start = 0; start < todo.length; start += BATCH) {
    const chunk = todo.slice(start, start + BATCH);
    const pairs = chunk.map((pair, index) => ({ id: index + 1, ...pair }));
    const answers = await ask(ai, pairs);
    const byId = new Map(answers.map((answer) => [answer.id, answer.same]));
    for (const pair of pairs) {
      const verdict = byId.get(pair.id);
      if (typeof verdict !== "boolean") continue;
      table.pairs[pair.key] = verdict;
      answered += 1;
      if (verdict === pair.same) agree += 1;
    }
    table.model = MODEL;
    fs.writeFileSync(TABLE_FILE, JSON.stringify(table));
    console.log(
      `  request ${Math.floor(start / BATCH) + 1}/${requests}: ${Object.keys(table.pairs).length} pairs in the table`,
    );
    if (start + BATCH < todo.length) await sleep(REQUEST_DELAY_MS);
  }
  console.log(
    `Agreed with ground truth on ${agree}/${answered} pairs of this run.`,
  );
};

run().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});
