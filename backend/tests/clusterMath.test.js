import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLUSTER_DEFAULTS,
  computeCentroid,
  deriveClusterStatus,
  dominantValue,
  fitsRadius,
  pickRepresentative,
  scoreAgainstCluster,
} from "../src/utils/clusterMath.js";

const base = { lat: 49.84, lng: 24.03 };
// About 0.001 degrees of latitude is ~111 m.
const at = (dLat) => ({ lat: base.lat + dLat, lng: base.lng });

test("centroid is the mean position and a unit mean vector", () => {
  const { point, embedding } = computeCentroid([
    { point: at(0), embedding: [1, 0] },
    { point: at(0.002), embedding: [0, 1] },
  ]);
  assert.ok(Math.abs(point.lat - (base.lat + 0.001)) < 1e-9);
  assert.ok(Math.abs(Math.hypot(...embedding) - 1) < 1e-9);
  assert.ok(Math.abs(embedding[0] - embedding[1]) < 1e-9);
});

test("centroid skips members without coordinates or vector", () => {
  const { point, embedding } = computeCentroid([
    { point: at(0), embedding: null },
    { point: null, embedding: [1, 0] },
  ]);
  assert.deepEqual(point, at(0));
  assert.deepEqual(embedding, [1, 0]);
});

test("a close report with the same meaning scores near 1", () => {
  const cluster = { point: at(0), embedding: [1, 0] };
  const score = scoreAgainstCluster(
    { point: at(0.0005), embedding: [1, 0] },
    cluster,
  );
  assert.ok(score > 0.95, `got ${score}`);
});

test("the same meaning far away scores only the semantic share", () => {
  const cluster = { point: at(0), embedding: [1, 0] };
  const score = scoreAgainstCluster(
    { point: at(0.02), embedding: [1, 0] },
    cluster,
    CLUSTER_DEFAULTS,
  );
  assert.ok(Math.abs(score - CLUSTER_DEFAULTS.alpha) < 1e-9, `got ${score}`);
});

test("a different meaning at the same spot scores below tau", () => {
  const cluster = { point: at(0), embedding: [1, 0] };
  const score = scoreAgainstCluster(
    { point: at(0), embedding: [0, 1] },
    cluster,
  );
  assert.ok(score < CLUSTER_DEFAULTS.tau, `got ${score}`);
});

test("fitsRadius checks every member against the centroid", () => {
  const members = [{ point: at(0) }, { point: at(0.003) }];
  assert.equal(fitsRadius(members, at(0.0015), 500), true);
  assert.equal(fitsRadius(members, at(0.0015), 100), false);
  assert.equal(fitsRadius([{ point: null }], at(0), 500), false);
});

test("cluster status follows the member statuses", () => {
  assert.equal(deriveClusterStatus(["resolved", "in_progress"]), "active");
  assert.equal(deriveClusterStatus(["new"]), "active");
  assert.equal(deriveClusterStatus(["resolved", "rejected"]), "resolved");
  assert.equal(deriveClusterStatus(["rejected"]), "closed");
});

test("dominantValue picks the most frequent, first on a tie", () => {
  assert.equal(dominantValue(["a", "b", "b"]), "b");
  assert.equal(dominantValue(["a", "b"]), "a");
  assert.equal(dominantValue([]), null);
});

test("representative is the member closest to the centre vector", () => {
  const members = [
    { id: "a", embedding: [1, 0] },
    { id: "b", embedding: [0.8, 0.6] },
    { id: "c", embedding: [0, 1] },
  ];
  assert.equal(pickRepresentative(members, [0.8, 0.6]), "b");
});

test("representative falls back to the first member without vectors", () => {
  const members = [
    { id: "a", embedding: null },
    { id: "b", embedding: null },
  ];
  assert.equal(pickRepresentative(members, null), "a");
  assert.equal(pickRepresentative(members, [1, 0]), "a");
  assert.equal(pickRepresentative([], [1, 0]), null);
});
