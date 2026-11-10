import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bestThreshold,
  buildPairs,
  f1At,
  precisionAtK,
  semanticGap,
} from "../src/utils/modelComparison.js";

const geo = (lng, lat) => ({ type: "Point", coordinates: [lng, lat] });
const item = (id, group, vector, split = "tune") => ({
  id,
  group,
  split,
  geo: geo(24.03, 49.84),
  vector,
});

const items = [
  item("a1", "A", [1, 0]),
  item("a2", "A", [0.99, 0.141]),
  item("a3", "A", [0.98, 0.199]),
  item("b1", "B", [0, 1]),
  item("b2", "B", [0.1, 0.995]),
];

test("precision@2 is 1 when the nearest two are the same group", () => {
  const queries = [items[0]];
  const p = precisionAtK(queries, items, { alpha: 1, k: 2 });
  assert.equal(p, 1);
});

test("precision@3 drops when only two relevant exist", () => {
  const p = precisionAtK([items[3]], items, { alpha: 1, k: 3 });
  assert.ok(Math.abs(p - 1 / 3) < 1e-9);
});

test("semantic gap is positive when groups are separated", () => {
  const result = semanticGap(items);
  assert.ok(result.same > result.different);
  assert.ok(result.gap > 0.5);
});

test("best threshold separates the pair classes", () => {
  const pairs = buildPairs(items, "tune");
  const { threshold, f1 } = bestThreshold(pairs);
  assert.equal(f1, 1);
  assert.equal(f1At(pairs, threshold).recall, 1);
});
