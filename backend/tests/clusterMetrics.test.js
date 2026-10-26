import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adjustedRandIndex,
  normalizedMutualInformation,
  purity,
} from "../src/utils/clusterMetrics.js";
import { pickCluster } from "../src/utils/clusterMath.js";

const truth = ["a", "a", "a", "b", "b", "b"];

test("identical partitions score 1 whatever the label names", () => {
  const predicted = [7, 7, 7, 3, 3, 3];
  assert.equal(purity(predicted, truth), 1);
  assert.ok(Math.abs(adjustedRandIndex(predicted, truth) - 1) < 1e-9);
  assert.ok(Math.abs(normalizedMutualInformation(predicted, truth) - 1) < 1e-9);
});

test("one big cluster is not pure and carries no information", () => {
  const predicted = [1, 1, 1, 1, 1, 1];
  assert.equal(purity(predicted, truth), 0.5);
  assert.ok(Math.abs(adjustedRandIndex(predicted, truth)) < 1e-9);
  assert.ok(Math.abs(normalizedMutualInformation(predicted, truth)) < 1e-9);
});

test("splitting a group lowers ARI but keeps purity at 1", () => {
  const predicted = [1, 1, 2, 3, 3, 3];
  assert.equal(purity(predicted, truth), 1);
  assert.ok(adjustedRandIndex(predicted, truth) < 1);
});

const base = { lat: 49.84, lng: 24.03 };
const at = (dLat) => ({ lat: base.lat + dLat, lng: base.lng });
const clusterAt = (dLat, embedding) => {
  const member = { point: at(dLat), embedding };
  return { point: at(dLat), embedding, members: [member] };
};

test("pickCluster joins a near cluster with the same meaning", () => {
  const near = clusterAt(0, [1, 0]);
  const member = { point: at(0.0005), embedding: [1, 0] };
  assert.equal(pickCluster(member, [near])?.cluster, near);
});

test("pickCluster opens a new cluster for another meaning or place", () => {
  const near = clusterAt(0, [1, 0]);
  assert.equal(pickCluster({ point: at(0), embedding: [0, 1] }, [near]), null);
  assert.equal(
    pickCluster({ point: at(0.02), embedding: [1, 0] }, [near]),
    null,
  );
});

test("pickCluster refuses a join that pushes a member out of the radius", () => {
  const cluster = {
    point: at(0.002),
    embedding: [1, 0],
    members: [
      { point: at(0), embedding: [1, 0] },
      { point: at(0.004), embedding: [1, 0] },
    ],
  };
  // Close enough to the centroid, but the moved centroid leaves a member ~315 m away.
  const member = { point: at(-0.0005), embedding: [1, 0] };
  const params = { alpha: 0.7, radiusM: 300, tau: 0.5 };
  assert.equal(pickCluster(member, [cluster], params), null);
});

test("pickCluster lets a judge verdict replace the tau test", () => {
  const cluster = clusterAt(0, [1, 0]);
  const other = { point: at(0), embedding: [0, 1] };
  assert.equal(pickCluster(other, [cluster]), null);
  assert.equal(
    pickCluster(other, [cluster], { judge: () => true })?.cluster,
    cluster,
  );

  const same = { point: at(0.0005), embedding: [1, 0] };
  assert.equal(pickCluster(same, [cluster], { judge: () => false }), null);
  assert.equal(
    pickCluster(same, [cluster], { judge: () => null })?.cluster,
    cluster,
  );
});
