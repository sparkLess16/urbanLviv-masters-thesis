// Compares clustering methods on the evaluation set in the experiment database.
// Everything runs in memory from stored vectors: no Gemini requests, no writes.
//
//   ours   hybrid score (meaning + distance), same code as the service
//   rule   same type, same district and centroid within the radius; no text
//
// Metrics against the ground-truth groups: cluster count, purity, ARI, NMI.
// Order dependence: the same reports are shuffled several times and ARI is
// averaged. The invariant check counts clusters that mix types or have a
// member farther than the radius from the centroid.
//
// Usage (from the backend directory):
//   npm run eval:clustering
//   npm run eval:clustering -- --tau 0.85 --alpha 0.7 --radius 500
//   npm run eval:clustering -- --sweep        # table over tau and alpha
import fs from "node:fs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Report from "../src/models/Report.js";
import { geoToLatLng } from "../src/utils/geo.js";
import { pairKey } from "../src/utils/judgePrompt.js";
import { distanceMeters } from "../src/utils/geoMath.js";
import {
  CLUSTER_DEFAULTS,
  combineVerdicts,
  computeCentroid,
  fitsRadius,
  judgePairsFor,
  pickCluster,
} from "../src/utils/clusterMath.js";
import {
  adjustedRandIndex,
  normalizedMutualInformation,
  purity,
} from "../src/utils/clusterMetrics.js";

dotenv.config();

const DB_NAME = process.env.EXPERIMENT_DB_NAME || "urbanlviv_experiments";
const SHUFFLES = 20;

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : Number(process.argv[index + 1]);
};

// Small seeded generator so shuffles are the same on every run.
const seededRandom = (seed) => {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffled = (items, random) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// Rule-based baseline: nearest cluster of the same type and district.
const pickByRule = (member, clusters, { radiusM }) => {
  const near = clusters
    .filter(
      (cluster) =>
        cluster.district_id === member.district_id &&
        distanceMeters(member.point, cluster.point) <= radiusM,
    )
    .sort(
      (a, b) =>
        distanceMeters(member.point, a.point) -
        distanceMeters(member.point, b.point),
    );

  for (const cluster of near) {
    const members = [...cluster.members, member];
    const centroid = computeCentroid(members);
    if (fitsRadius(members, centroid.point, radiusM)) {
      return { cluster, members, centroid };
    }
  }
  return null;
};

const METHODS = { ours: pickCluster, rule: pickByRule };

// Runs incremental clustering over reports in the given order.
// Returns clusters: [{ type_id, district_id, point, embedding, members }].
const clusterAll = (reports, pick, params) => {
  const clusters = [];
  for (const report of reports) {
    const sameType = clusters.filter((c) => c.type_id === report.type_id);
    const picked = pick(report, sameType, params);
    if (picked) {
      Object.assign(picked.cluster, {
        members: picked.members,
        point: picked.centroid.point,
        embedding: picked.centroid.embedding,
      });
    } else {
      clusters.push({
        type_id: report.type_id,
        district_id: report.district_id,
        point: report.point,
        embedding: report.embedding,
        members: [report],
      });
    }
  }
  return clusters;
};

const labelsOf = (reports, clusters, groupOf) => {
  const clusterOf = new Map();
  clusters.forEach((cluster, index) => {
    for (const member of cluster.members) clusterOf.set(member.id, index);
  });
  return {
    predicted: reports.map((report) => clusterOf.get(report.id)),
    truth: reports.map((report) => groupOf.get(report.id)),
  };
};

const violations = (clusters, radiusM) =>
  clusters.filter((cluster) => {
    const mixedType = cluster.members.some(
      (member) => member.type_id !== cluster.type_id,
    );
    const { point } = computeCentroid(cluster.members);
    return mixedType || !fitsRadius(cluster.members, point, radiusM);
  }).length;

const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
const sd = (values) => {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
};

const evaluate = (reports, groupOf, method, params, shuffles = SHUFFLES) => {
  const pick = METHODS[method];
  const ordered = clusterAll(reports, pick, params);
  const { predicted, truth } = labelsOf(reports, ordered, groupOf);

  const random = seededRandom(42);
  const aris = [];
  for (let i = 0; i < shuffles; i += 1) {
    const order = shuffled(reports, random);
    const clusters = clusterAll(order, pick, params);
    const labels = labelsOf(reports, clusters, groupOf);
    aris.push(adjustedRandIndex(labels.predicted, labels.truth));
  }

  return {
    clusters: ordered.length,
    purity: purity(predicted, truth),
    ari: adjustedRandIndex(predicted, truth),
    nmi: normalizedMutualInformation(predicted, truth),
    ariMean: aris.length ? mean(aris) : NaN,
    ariSd: aris.length ? sd(aris) : NaN,
    violations: violations(ordered, params.radiusM),
  };
};

const row = (label, r) =>
  `${label.padEnd(14)} ${String(r.clusters).padStart(3)}  ` +
  `${r.purity.toFixed(3)}  ${r.ari.toFixed(3)}  ${r.nmi.toFixed(3)}  ` +
  `${r.ariMean.toFixed(3)}±${r.ariSd.toFixed(3)}  ${r.violations}`;

const HEADER =
  "method        clusters purity   ARI    NMI   ARI shuffled   invariant breaks";

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB_NAME });
  console.log(`Database: ${mongoose.connection.name}`);

  const labels = await mongoose.connection
    .collection("eval_labels")
    .find()
    .toArray();
  const groupOf = new Map(labels.map((l) => [String(l.report_id), l.group_id]));
  const docs = await Report.find({ _id: { $in: [...groupOf.keys()] } })
    .select("+embedding")
    .sort({ created_dt: 1 })
    .lean();
  const reports = docs
    .filter((doc) => doc.embedding && doc.geo)
    .map((doc) => ({
      id: String(doc._id),
      title: doc.title,
      type_id: doc.type_id,
      district_id: doc.district_id,
      point: geoToLatLng(doc.geo),
      embedding: doc.embedding,
    }));
  const groups = new Set(groupOf.values()).size;
  console.log(`${reports.length} reports in ${groups} ground-truth groups\n`);

  const radiusM = arg("radius", CLUSTER_DEFAULTS.radiusM);
  await mongoose.disconnect();

  if (process.argv.includes("--sweep")) {
    console.log(`Method ours, radius ${radiusM} m\n${HEADER}`);
    for (const alpha of [0.9, 0.7, 0.5]) {
      for (const tau of [0.7, 0.75, 0.8, 0.85, 0.9]) {
        const params = { alpha, radiusM, tau };
        console.log(
          row(
            `a=${alpha} t=${tau}`,
            evaluate(reports, groupOf, "ours", params),
          ),
        );
      }
    }
    return;
  }

  if (process.argv.includes("--judge")) {
    // Short trial: when the closest member of a candidate cluster is in the
    // grey zone, the judge table decides instead of the score threshold.
    const table = JSON.parse(
      fs.readFileSync(
        process.argv[process.argv.indexOf("--judge") + 1],
        "utf8",
      ),
    ).pairs;
    const low = arg("low", 0.8);
    const high = arg("high", 0.92);
    const splitOf = new Map(
      JSON.parse(
        fs.readFileSync(
          new URL("../data/eval/eval_set.json", import.meta.url),
          "utf8",
        ),
      ).groups.map((g) => [g.group_id, g.split]),
    );
    const only = process.argv.includes("--only")
      ? process.argv[process.argv.indexOf("--only") + 1]
      : "tune";
    const part = reports.filter((r) => splitOf.get(groupOf.get(r.id)) === only);
    const datasetOf = new Map(
      labels.map((l) => [String(l.report_id), l.dataset_id]),
    );
    // Same rule as the service: judgePairsFor picks the borderline members,
    // their answers come from the table instead of Gemini.
    const k = arg("k", 3);
    const vote = process.argv.includes("--vote")
      ? process.argv[process.argv.indexOf("--vote") + 1]
      : "any";
    const judge = (member, cluster) => {
      const verdicts = judgePairsFor(member, cluster, { low, high, k })
        .map(
          (other) =>
            table[pairKey(datasetOf.get(member.id), datasetOf.get(other.id))],
        )
        .filter((verdict) => typeof verdict === "boolean");
      return combineVerdicts(verdicts, vote);
    };
    METHODS.judge = (member, clusters, p) =>
      pickCluster(member, clusters, { ...p, judge });

    const params = {
      alpha: arg("alpha", CLUSTER_DEFAULTS.alpha),
      radiusM,
      tau: arg("tau", CLUSTER_DEFAULTS.tau),
    };
    console.log(
      `${only} groups (${part.length} reports), grey zone ${low}-${high}, alpha ${params.alpha}, tau ${params.tau}\n${HEADER}`,
    );
    for (const method of ["ours", "judge", "rule"]) {
      console.log(row(method, evaluate(part, groupOf, method, params)));
    }
    const clusters = clusterAll(part, METHODS.judge, params);
    for (const cluster of clusters) {
      const found = new Set(cluster.members.map((m) => groupOf.get(m.id)));
      if (found.size < 2) continue;
      console.log(`Still mixed with the judge: ${[...found].join(" + ")}`);
    }
    return;
  }

  if (process.argv.includes("--tune-test")) {
    // Parameters are chosen on the tune groups only, then reported on test.
    const splitOf = new Map(
      JSON.parse(
        fs.readFileSync(
          new URL("../data/eval/eval_set.json", import.meta.url),
          "utf8",
        ),
      ).groups.map((g) => [g.group_id, g.split]),
    );
    const part = (name) =>
      reports.filter((r) => splitOf.get(groupOf.get(r.id)) === name);
    const tune = part("tune");
    const test = part("test");
    console.log(`tune: ${tune.length} reports, test: ${test.length} reports
`);

    const alphas = [0.9, 0.7, 0.5, 0.3];
    const taus = [0.7, 0.75, 0.8, 0.85, 0.9, 0.95];
    let best = null;
    console.log(`Grid on tune groups (radius ${radiusM} m, no shuffles)`);
    console.log(HEADER);
    for (const alpha of alphas) {
      for (const tau of taus) {
        const params = { alpha, radiusM, tau };
        const result = evaluate(tune, groupOf, "ours", params, 0);
        console.log(row(`a=${alpha} t=${tau}`, result));
        // Best ARI wins; ties go to higher purity, then to the setting
        // closest to the defaults, so a flat grid does not pick a corner.
        const distance =
          Math.abs(alpha - CLUSTER_DEFAULTS.alpha) +
          Math.abs(tau - CLUSTER_DEFAULTS.tau);
        const better =
          !best ||
          result.ari > best.result.ari + 1e-9 ||
          (Math.abs(result.ari - best.result.ari) <= 1e-9 &&
            (result.purity > best.result.purity + 1e-9 ||
              (Math.abs(result.purity - best.result.purity) <= 1e-9 &&
                distance < best.distance)));
        if (better) best = { params, result, distance };
      }
    }
    console.log(
      `
Chosen on tune: alpha ${best.params.alpha}, tau ${best.params.tau}
`,
    );

    const defaults = { ...CLUSTER_DEFAULTS, radiusM };
    for (const [name, data] of [
      ["tune", tune],
      ["test", test],
    ]) {
      console.log(`${name.toUpperCase()} groups
${HEADER}`);
      console.log(
        row("ours (chosen)", evaluate(data, groupOf, "ours", best.params)),
      );
      console.log(
        row("ours (defaults)", evaluate(data, groupOf, "ours", defaults)),
      );
      console.log(row("rule", evaluate(data, groupOf, "rule", defaults)));
      console.log();
    }
    return;
  }

  const params = {
    alpha: arg("alpha", CLUSTER_DEFAULTS.alpha),
    radiusM,
    tau: arg("tau", CLUSTER_DEFAULTS.tau),
  };
  console.log(
    `alpha ${params.alpha}, tau ${params.tau}, radius ${radiusM} m\n${HEADER}`,
  );
  for (const method of Object.keys(METHODS)) {
    console.log(row(method, evaluate(reports, groupOf, method, params)));
  }

  // Clusters that hold more than one ground-truth group, for inspection.
  const clusters = clusterAll(reports, METHODS.ours, params);
  for (const cluster of clusters) {
    const found = new Set(cluster.members.map((m) => groupOf.get(m.id)));
    if (found.size < 2) continue;
    console.log(`
Mixed cluster (${[...found].join(" + ")}):`);
    for (const m of cluster.members) {
      console.log(`  ${groupOf.get(m.id)}  ${m.title}`);
    }
  }
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
