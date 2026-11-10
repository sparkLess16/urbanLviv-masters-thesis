import { rankCandidates } from "../services/similarityService.js";
import { distanceMeters, dotProduct } from "./geoMath.js";
import { geoToLatLng } from "./geo.js";

// Pure helpers for comparing embedding models on the labelled set, in memory.
// item: { id, group, split, geo, vector } (vector must be normalized).

const clampCosine = (a, b) => Math.min(1, Math.max(0, dotProduct(a, b)));

// Precision@k for every query in `queries`; candidates are all other items
// within radiusM of the query (the same set geo-first search looks at).
export const precisionAtK = (
  queries,
  items,
  { alpha, radiusM = 500, k = 5 },
) => {
  let sum = 0;
  for (const query of queries) {
    const point = geoToLatLng(query.geo);
    const candidates = items
      .filter((item) => item.id !== query.id)
      .filter((item) => {
        const location = geoToLatLng(item.geo);
        return location && distanceMeters(point, location) <= radiusM;
      })
      .map((item) => ({
        _id: item.id,
        geo: item.geo,
        semantic: clampCosine(query.vector, item.vector),
      }));
    const top = rankCandidates(candidates, { point, alpha, radiusM, limit: k });
    const relevant = top.filter(
      (hit) =>
        items.find((item) => item.id === hit.reportId).group === query.group,
    ).length;
    sum += relevant / k;
  }
  return sum / queries.length;
};

const mean = (values) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;

// Average cosine of same-group pairs vs different-group pairs (within radiusM)
// and the gap between them: the larger, the easier to separate by a threshold.
export const semanticGap = (items, radiusM = 500) => {
  const same = [];
  const different = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i];
      const b = items[j];
      const distance = distanceMeters(geoToLatLng(a.geo), geoToLatLng(b.geo));
      if (distance > radiusM) continue;
      const cosine = dotProduct(a.vector, b.vector);
      (a.group === b.group ? same : different).push(cosine);
    }
  }
  return {
    same: mean(same),
    different: mean(different),
    gap: mean(same) - mean(different),
    pairs: same.length + different.length,
  };
};

// Labelled pairs within radiusM whose both members belong to `split`.
export const buildPairs = (items, split, radiusM = 500) => {
  const pairs = [];
  const pool = items.filter((item) => item.split === split);
  for (let i = 0; i < pool.length; i += 1) {
    for (let j = i + 1; j < pool.length; j += 1) {
      const distance = distanceMeters(
        geoToLatLng(pool[i].geo),
        geoToLatLng(pool[j].geo),
      );
      if (distance > radiusM) continue;
      pairs.push({
        score: dotProduct(pool[i].vector, pool[j].vector),
        positive: pool[i].group === pool[j].group,
      });
    }
  }
  return pairs;
};

export const f1At = (pairs, threshold) => {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const pair of pairs) {
    const predicted = pair.score >= threshold;
    if (predicted && pair.positive) tp += 1;
    else if (predicted) fp += 1;
    else if (pair.positive) fn += 1;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 =
    precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1 };
};

// Threshold (step 0.005 over 0.5..1) with the best F1 on the given pairs.
export const bestThreshold = (pairs) => {
  let best = { threshold: 0.5, f1: -1 };
  for (let t = 0.5; t <= 1.0001; t += 0.005) {
    const { f1 } = f1At(pairs, t);
    if (f1 > best.f1) best = { threshold: Number(t.toFixed(3)), f1 };
  }
  return best;
};
