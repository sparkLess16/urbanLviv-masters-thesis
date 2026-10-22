import test from "node:test";
import assert from "node:assert/strict";
import {
  bestF1,
  buildPairs,
  describePairs,
  pickThresholds,
  scorePair,
  sweepThresholds,
} from "../src/utils/thresholdTuning.js";

const geo = (lat, lng) => ({ type: "Point", coordinates: [lng, lat] });
const options = { alpha: 0.7, radiusM: 500 };

const report = (id, embedding, point, type_id = "roads") => ({
  _id: id,
  embedding,
  geo: geo(...point),
  type_id,
});

test("identical vectors at the same place score 1", () => {
  const a = report("a", [1, 0], [49.84, 24.03]);
  const { score, distance } = scorePair(a, { ...a, _id: "b" }, options);
  assert.equal(score, 1);
  assert.equal(distance, 0);
});

test("the type bonus applies only to the same type and is capped at 1", () => {
  const a = report("a", [1, 0], [49.84, 24.03], "roads");
  const sameType = report("b", [0.6, 0.8], [49.84, 24.03], "roads");
  const otherType = report("c", [0.6, 0.8], [49.84, 24.03], "garbage");

  const plain = scorePair(a, sameType, options).score;
  assert.ok(
    scorePair(a, sameType, { ...options, typeBonus: 0.05 }).score > plain,
  );
  assert.equal(
    scorePair(a, otherType, { ...options, typeBonus: 0.05 }).score,
    scorePair(a, otherType, options).score,
  );
  assert.equal(
    scorePair(a, { ...a, _id: "x" }, { ...options, typeBonus: 0.5 }).score,
    1,
  );
});

// Three reports: a and b are the same problem, c is another one far away.
const reports = [
  report("a", [1, 0], [49.84, 24.03]),
  report("b", [0.99, 0.14], [49.8402, 24.0301]),
  report("c", [0, 1], [49.85, 24.05]),
];
const groupOf = new Map([
  ["a", "g1"],
  ["b", "g1"],
  ["c", "g2"],
]);

test("buildPairs makes every unordered pair with its ground truth", () => {
  const pairs = buildPairs(reports, groupOf, options);
  assert.equal(pairs.length, 3);
  assert.equal(pairs.filter((pair) => pair.positive).length, 1);
});

test("a high threshold flags the real duplicate and nothing else", () => {
  const pairs = buildPairs(reports, groupOf, options);
  const [row] = sweepThresholds(pairs, 500, [0.8]);
  assert.deepEqual(
    { tp: row.tp, fp: row.fp, fn: row.fn },
    { tp: 1, fp: 0, fn: 0 },
  );
  assert.equal(row.precision, 1);
  assert.equal(row.recall, 1);
});

test("a far pair is never flagged, however similar its text", () => {
  const far = [
    report("a", [1, 0], [49.84, 24.03]),
    report("b", [1, 0], [49.9, 24.1]),
  ];
  const pairs = buildPairs(
    far,
    new Map([
      ["a", "g"],
      ["b", "g"],
    ]),
    options,
  );
  const [row] = sweepThresholds(pairs, 500, [0.5]);
  assert.equal(row.tp, 0);
  assert.equal(row.fn, 1);
});

test("pickThresholds takes the lowest precise and the highest sensitive", () => {
  const rows = [
    {
      threshold: 0.5,
      tp: 9,
      fp: 9,
      fn: 1,
      precision: 0.5,
      recall: 0.9,
      f1: 0.64,
    },
    {
      threshold: 0.6,
      tp: 9,
      fp: 1,
      fn: 1,
      precision: 0.9,
      recall: 0.9,
      f1: 0.9,
    },
    {
      threshold: 0.7,
      tp: 8,
      fp: 0,
      fn: 2,
      precision: 1,
      recall: 0.8,
      f1: 0.89,
    },
    {
      threshold: 0.8,
      tp: 5,
      fp: 0,
      fn: 5,
      precision: 1,
      recall: 0.5,
      f1: 0.67,
    },
  ];
  const { dialog, hint } = pickThresholds(rows, {
    minPrecision: 0.95,
    minRecall: 0.9,
  });
  assert.equal(dialog.threshold, 0.7);
  assert.equal(hint.threshold, 0.6);
  assert.equal(bestF1(rows).threshold, 0.6);
});

test("unreachable goals give null", () => {
  const rows = [
    {
      threshold: 0.5,
      tp: 1,
      fp: 9,
      fn: 9,
      precision: 0.1,
      recall: 0.1,
      f1: 0.1,
    },
  ];
  assert.deepEqual(pickThresholds(rows), { dialog: null, hint: null });
});

test("describePairs counts negatives close enough to be flagged", () => {
  const pairs = buildPairs(reports, groupOf, options);
  const info = describePairs(pairs, 500);
  assert.equal(info.positives, 1);
  assert.equal(info.negatives, 2);
  assert.ok(info.meanPositive > 0.9);
});
