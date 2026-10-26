import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSimilarityParams } from "../src/utils/similarityParams.js";

test("uses defaults when nothing is given", () => {
  const { params, error } = parseSimilarityParams({});
  assert.equal(error, undefined);
  assert.deepEqual(params, {
    strategy: "vector",
    alpha: 0.8,
    radiusM: 500,
    limit: 5,
  });
});

test("reads valid values from the query string", () => {
  const { params } = parseSimilarityParams({
    strategy: "geo",
    alpha: "0.5",
    radius: "300",
    limit: "10",
  });
  assert.deepEqual(params, {
    strategy: "geo",
    alpha: 0.5,
    radiusM: 300,
    limit: 10,
  });
});

test("rejects unknown strategy and out-of-range values", () => {
  assert.ok(parseSimilarityParams({ strategy: "magic" }).error);
  assert.ok(parseSimilarityParams({ alpha: "2" }).error);
  assert.ok(parseSimilarityParams({ radius: "10" }).error);
  assert.ok(parseSimilarityParams({ limit: "abc" }).error);
  assert.ok(parseSimilarityParams({ strategy: "constructor" }).error);
});
