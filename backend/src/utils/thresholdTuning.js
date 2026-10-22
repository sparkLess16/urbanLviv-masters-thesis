import { geoToLatLng } from "./geo.js";
import {
  combineScores,
  distanceMeters,
  dotProduct,
  spatialScore,
} from "./geoMath.js";

// Everything here is pure: no database, no Gemini. The script
// scripts/evalDuplicates.js loads the reports and calls these functions.

// Similarity of two reports: the same formula as the search, plus an optional
// bonus when both have the same type. Score and distance of the pair.
// report: { embedding, geo, type_id }
export const scorePair = (a, b, { alpha, radiusM, typeBonus = 0 }) => {
  const semantic = Math.min(
    1,
    Math.max(0, dotProduct(a.embedding, b.embedding)),
  );
  const pointA = geoToLatLng(a.geo);
  const pointB = geoToLatLng(b.geo);
  const distance = pointA && pointB ? distanceMeters(pointA, pointB) : null;
  const base = combineScores(semantic, spatialScore(distance, radiusM), alpha);
  const bonus = a.type_id && a.type_id === b.type_id ? typeBonus : 0;
  return { score: Math.min(1, base + bonus), distance };
};

// Every unordered pair of reports with its score, distance and ground truth.
// groupOf: Map(String(reportId) -> group id). Positive = same group.
export const buildPairs = (reports, groupOf, options) => {
  const pairs = [];
  for (let i = 0; i < reports.length; i += 1) {
    for (let j = i + 1; j < reports.length; j += 1) {
      const { score, distance } = scorePair(reports[i], reports[j], options);
      pairs.push({
        score,
        distance,
        positive:
          groupOf.get(String(reports[i]._id)) ===
          groupOf.get(String(reports[j]._id)),
      });
    }
  }
  return pairs;
};

// A pair is flagged when its score reaches the threshold and the two reports
// are within the radius (a similar text far away is another problem).
const isFlagged = (pair, threshold, radiusM) =>
  pair.score >= threshold && pair.distance !== null && pair.distance <= radiusM;

// Precision and recall of "flag the pair" for each threshold.
export const sweepThresholds = (pairs, radiusM, thresholds) =>
  thresholds.map((threshold) => {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (const pair of pairs) {
      const flagged = isFlagged(pair, threshold, radiusM);
      if (flagged && pair.positive) tp += 1;
      else if (flagged) fp += 1;
      else if (pair.positive) fn += 1;
    }
    const precision = tp + fp === 0 ? null : tp / (tp + fp);
    const recall = tp + fn === 0 ? null : tp / (tp + fn);
    const f1 =
      precision && recall ? (2 * precision * recall) / (precision + recall) : 0;
    return { threshold, tp, fp, fn, precision, recall, f1 };
  });

// dialog: the lowest threshold whose precision reaches minPrecision (few false
// alarms). hint: the highest threshold whose recall reaches minRecall (rarely
// misses a real duplicate). Either may be null when the goal is unreachable.
export const pickThresholds = (
  rows,
  { minPrecision = 0.95, minRecall = 0.9 } = {},
) => {
  const dialog =
    rows.find((row) => row.tp > 0 && row.precision >= minPrecision) ?? null;
  const hint =
    [...rows].reverse().find((row) => row.recall >= minRecall) ?? null;
  return { dialog, hint };
};

export const bestF1 = (rows) =>
  rows.reduce((best, row) => (row.f1 > (best?.f1 ?? -1) ? row : best), null);

// Counts that show how hard the data is: negative pairs close enough to be
// flagged at all, and mean scores of positives and of such negatives.
export const describePairs = (pairs, radiusM) => {
  const mean = (values) =>
    values.length === 0
      ? null
      : values.reduce((sum, value) => sum + value, 0) / values.length;
  const positives = pairs.filter((pair) => pair.positive);
  const nearNegatives = pairs.filter(
    (pair) =>
      !pair.positive && pair.distance !== null && pair.distance <= radiusM,
  );
  return {
    positives: positives.length,
    negatives: pairs.length - positives.length,
    nearNegatives: nearNegatives.length,
    meanPositive: mean(positives.map((pair) => pair.score)),
    meanNearNegative: mean(nearNegatives.map((pair) => pair.score)),
  };
};
