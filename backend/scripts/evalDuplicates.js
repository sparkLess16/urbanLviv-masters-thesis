// Picks the two thresholds of FR-02 on the evaluation set in the experiment
// database. Every pair of labelled reports is scored with the stored vectors
// (no Gemini requests, nothing is written). A pair is a real duplicate when
// both reports belong to the same ground-truth group.
//   hint threshold:   shows a report as a hint (high recall)
//   dialog threshold: asks "is it the same problem?" at submit (high precision)
//
// Usage (from the backend directory):
//   npm run eval:duplicates
//   npm run eval:duplicates -- --alpha 0.7 --radius 500 --bonus 0.03
//   npm run eval:duplicates -- --min-precision 0.95 --min-recall 0.9
import dotenv from "dotenv";
import mongoose from "mongoose";
import Report from "../src/models/Report.js";
import { DEFAULTS } from "../src/services/similarityService.js";
import {
  bestF1,
  buildPairs,
  describePairs,
  pickThresholds,
  sweepThresholds,
} from "../src/utils/thresholdTuning.js";

dotenv.config();

const DB_NAME = process.env.EXPERIMENT_DB_NAME || "urbanlviv_experiments";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

// Thresholds are applied to the similarity of the texts alone (alpha 1) plus a
// separate distance condition, see src/config/duplicateThresholds.js.
const alpha = Number(arg("alpha", 1));
const radiusM = Number(arg("radius", DEFAULTS.radiusM));
const bonus = Number(arg("bonus", 0.03));
const minPrecision = Number(arg("min-precision", 0.95));
const minRecall = Number(arg("min-recall", 0.9));

const THRESHOLDS = Array.from({ length: 19 }, (_, i) =>
  Number((0.5 + i * 0.025).toFixed(3)),
);

const pct = (value) => (value === null ? "  -  " : value.toFixed(3));

const printTable = (rows) => {
  console.log("threshold    tp    fp    fn  precision  recall     f1");
  for (const row of rows) {
    console.log(
      `${row.threshold.toFixed(3).padEnd(9)} ${String(row.tp).padStart(5)} ${String(row.fp).padStart(5)} ${String(row.fn).padStart(5)}  ${pct(row.precision).padStart(9)} ${pct(row.recall).padStart(7)} ${row.f1.toFixed(3).padStart(6)}`,
    );
  }
};

const summarise = (label, pairs) => {
  const rows = sweepThresholds(pairs, radiusM, THRESHOLDS);
  const { dialog, hint } = pickThresholds(rows, { minPrecision, minRecall });
  const best = bestF1(rows);
  const describe = describePairs(pairs, radiusM);

  console.log(`\n=== ${label} ===`);
  console.log(
    `pairs: ${describe.positives} same-problem, ${describe.negatives} different (of them ${describe.nearNegatives} within ${radiusM} m)`,
  );
  console.log(
    `mean score: same-problem ${describe.meanPositive?.toFixed(3)}, different but near ${describe.meanNearNegative?.toFixed(3) ?? "-"}`,
  );
  printTable(rows);
  console.log(
    `dialog threshold (precision >= ${minPrecision}): ${dialog ? `${dialog.threshold} (precision ${pct(dialog.precision)}, recall ${pct(dialog.recall)})` : "not reachable"}`,
  );
  console.log(
    `hint threshold   (recall >= ${minRecall}):    ${hint ? `${hint.threshold} (precision ${pct(hint.precision)}, recall ${pct(hint.recall)})` : "not reachable"}`,
  );
  console.log(`best F1: ${best.f1.toFixed(3)} at ${best.threshold}`);
  return best.f1;
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB_NAME });
  console.log(`Database: ${mongoose.connection.name} (read only)`);

  const labels = await mongoose.connection
    .collection("eval_labels")
    .find()
    .toArray();
  const groupOf = new Map(labels.map((l) => [String(l.report_id), l.group_id]));
  const reports = await Report.find({ _id: { $in: [...groupOf.keys()] } })
    .select("+embedding geo type_id")
    .lean();
  console.log(
    `${reports.length} labelled report(s); alpha ${alpha}, radius ${radiusM} m`,
  );

  const plain = buildPairs(reports, groupOf, { alpha, radiusM });
  const withBonus = buildPairs(reports, groupOf, {
    alpha,
    radiusM,
    typeBonus: bonus,
  });

  const plainF1 = summarise("Formula as is", plain);
  const bonusF1 = summarise(`With +${bonus} for the same type`, withBonus);

  console.log(
    `\nType bonus changes the best F1 by ${(bonusF1 - plainF1).toFixed(3)} (${plainF1.toFixed(3)} -> ${bonusF1.toFixed(3)}).`,
  );
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
