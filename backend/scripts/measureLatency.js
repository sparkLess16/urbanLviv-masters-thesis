// Measures NFR-01: response time of the similar-report endpoints on the load
// database (10 000 reports). Starts the real Express app in this process and
// calls it over HTTP, so routing, auth and JSON are included in the time.
// Makes Gemini requests only for the "suggest" part (one per call).
//
// Usage (from the backend directory):
//   npm run measure:latency                 # related (vector + geo), 120 calls each, and 30 suggest calls
//   npm run measure:latency -- --n 200 --suggest 0
//
// Results are printed and saved to data/results/ev_latency.json.
import fs from "node:fs";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import app from "../src/app.js";
import Report from "../src/models/Report.js";
import User from "../src/models/User.js";
import crypto from "node:crypto";
import { geoToLatLng, isWithinLviv } from "../src/utils/geo.js";

dotenv.config();

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : Number(process.argv[index + 1]);
};

const has = (flag) => process.argv.includes(flag);
const outIndex = process.argv.indexOf("--out");
const OUT_NAME = outIndex === -1 ? "ev_latency" : process.argv[outIndex + 1];
const RESULT_FILE = new URL(
  `../data/results/${OUT_NAME}.json`,
  import.meta.url,
);
const DB_NAME = process.env.LOAD_DB_NAME || "urbanlviv_experiments_load";
const N = arg("n", 120);
const SUGGEST_N = arg("suggest", 30);
// Matches the limiter on /suggest (10 per minute per user).
const SUGGEST_GAP_MS = 6500;
const WARMUP = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const percentile = (sorted, p) =>
  sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

const summarize = (times) => {
  const sorted = [...times].sort((a, b) => a - b);
  const round = (v) => Math.round(v * 10) / 10;
  return {
    calls: sorted.length,
    p50_ms: round(percentile(sorted, 50)),
    p95_ms: round(percentile(sorted, 95)),
    max_ms: round(sorted[sorted.length - 1]),
    mean_ms: round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
  };
};

const timed = async (call) => {
  const start = performance.now();
  const response = await call();
  const body = await response.json();
  return { ms: performance.now() - start, status: response.status, body };
};

const run = async () => {
  if (!DB_NAME.includes("experiment")) {
    throw new Error(`Database name must contain "experiment" (got ${DB_NAME})`);
  }
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB_NAME });
  const total = await Report.countDocuments();
  console.log(`Database: ${DB_NAME}, ${total} report(s)`);

  // The clones belong to "load@example.test"; suggest ignores the caller's own
  // reports, so the requests come from a second user.
  if (!(await User.exists({ email: "load@example.test" }))) {
    throw new Error("Load user not found, run npm run seed:load");
  }
  const user =
    (await User.findOne({ email: "requester@example.test" })) ??
    (await User.create({
      name: "Load Requester",
      email: "requester@example.test",
      password: crypto.randomBytes(32).toString("hex"),
      isVerified: true,
    }));
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;

  const sample = await Report.aggregate([
    { $match: { status_id: { $nin: ["cancelled", "resolved"] } } },
    { $sample: { size: Math.max(N + WARMUP, SUGGEST_N) } },
    { $project: { title: 1, description: 1, geo: 1 } },
  ]);

  const inLviv = sample.filter((report) => {
    const point = geoToLatLng(report.geo);
    return point && isWithinLviv(point.lat, point.lng);
  });
  const previous = fs.existsSync(RESULT_FILE)
    ? JSON.parse(fs.readFileSync(RESULT_FILE, "utf8"))
    : {};
  const results = { ...previous, database: DB_NAME, reports: total };
  if (!has("--skip-related")) results.related = {};

  for (const strategy of has("--skip-related") ? [] : ["vector", "geo"]) {
    const times = [];
    let withItems = 0;
    for (let i = 0; i < N + WARMUP; i += 1) {
      const { ms, status, body } = await timed(() =>
        fetch(
          `${base}/api/reports/${sample[i % sample.length]._id}/related?strategy=${strategy}`,
          { headers },
        ),
      );
      if (status !== 200)
        throw new Error(`related ${strategy}: HTTP ${status}`);
      if (i >= WARMUP) {
        times.push(ms);
        if (body.items.length > 0) withItems += 1;
      }
    }
    results.related[strategy] = {
      ...summarize(times),
      calls_with_results: withItems,
    };
    console.log(`related (${strategy}-first):`, results.related[strategy]);
  }

  if (SUGGEST_N > 0) {
    const times = [];
    let withGemini = 0;
    const reasons = {};
    for (let i = 0; i < SUGGEST_N; i += 1) {
      const item = inLviv[i % inLviv.length];
      const point = geoToLatLng(item.geo);
      // A unique suffix defeats the vector cache, so every call reaches Gemini.
      const { ms, status, body } = await timed(() =>
        fetch(`${base}/api/reports/suggest`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            title: item.title,
            description: `${item.description} (check ${Date.now()}-${i})`,
            lat: point.lat,
            lng: point.lng,
          }),
        }),
      );
      if (status !== 200)
        throw new Error(`suggest: HTTP ${status} ${body.message ?? ""}`);
      times.push(ms);
      if (!body.reason) withGemini += 1;
      else reasons[body.reason] = (reasons[body.reason] ?? 0) + 1;
      await sleep(SUGGEST_GAP_MS);
    }
    results.suggest = {
      ...summarize(times),
      calls_with_gemini: withGemini,
      reasons,
    };
    console.log("suggest:", results.suggest);
  }

  fs.mkdirSync(new URL("../data/results/", import.meta.url), {
    recursive: true,
  });
  fs.writeFileSync(RESULT_FILE, JSON.stringify(results, null, 2));
  server.close();
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
