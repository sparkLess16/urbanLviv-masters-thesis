import { test } from "node:test";
import assert from "node:assert/strict";
import { rankCandidates } from "../src/services/similarityService.js";
import {
  atlasScoreToCosine,
  combineScores,
  distanceMeters,
  dotProduct,
  spatialScore,
} from "../src/utils/geoMath.js";

const point = { lat: 49.84, lng: 24.03 };
// About 0.001 degrees of latitude is ~111 m.
const geoAt = (dLat) => ({
  type: "Point",
  coordinates: [point.lng, point.lat + dLat],
});

const options = { point, alpha: 0.7, radiusM: 500, limit: 5 };

test("haversine gives a known distance", () => {
  const d = distanceMeters(point, { lat: 49.841, lng: 24.03 });
  assert.ok(d > 110 && d < 112, `got ${d}`);
});

test("spatial score falls linearly to zero at the radius", () => {
  assert.equal(spatialScore(0, 500), 1);
  assert.equal(spatialScore(250, 500), 0.5);
  assert.equal(spatialScore(500, 500), 0);
  assert.equal(spatialScore(900, 500), 0);
  assert.equal(spatialScore(null, 500), 0);
});

test("converts Atlas score back to cosine and clamps", () => {
  assert.equal(atlasScoreToCosine(1), 1);
  assert.equal(atlasScoreToCosine(0.5), 0);
  assert.equal(atlasScoreToCosine(0.9), 0.8);
  assert.equal(atlasScoreToCosine(0.2), 0);
});

test("combines scores with alpha", () => {
  assert.equal(combineScores(1, 0, 0.7), 0.7);
  assert.equal(combineScores(0.5, 1, 0.5), 0.75);
});

test("dot product of unit vectors is their cosine", () => {
  assert.equal(dotProduct([1, 0], [1, 0]), 1);
  assert.equal(dotProduct([1, 0], [0, 1]), 0);
});

test("nearby report beats a far one with the same meaning", () => {
  const ranked = rankCandidates(
    [
      { _id: "far", semantic: 0.9, geo: geoAt(0.01) },
      { _id: "near", semantic: 0.9, geo: geoAt(0.0005) },
    ],
    options,
  );
  assert.deepEqual(
    ranked.map((r) => r.reportId),
    ["near", "far"],
  );
  assert.equal(ranked[1].spatial_score, 0);
  assert.ok(ranked[0].distance_m > 50 && ranked[0].distance_m < 60);
});

test("closer meaning wins when distances are equal", () => {
  const ranked = rankCandidates(
    [
      { _id: "a", semantic: 0.6, geo: geoAt(0.0005) },
      { _id: "b", semantic: 0.8, geo: geoAt(0.0005) },
    ],
    options,
  );
  assert.equal(ranked[0].reportId, "b");
});

test("without a query point only meaning counts", () => {
  const ranked = rankCandidates(
    [
      { _id: "a", semantic: 0.6, geo: geoAt(0.0001) },
      { _id: "b", semantic: 0.8, geo: null },
    ],
    { ...options, point: null },
  );
  assert.equal(ranked[0].reportId, "b");
  assert.equal(ranked[0].score, 0.8);
  assert.equal(ranked[0].distance_m, null);
});

test("a candidate without coordinates gets spatial score 0", () => {
  const [item] = rankCandidates([{ _id: "x", semantic: 0.8 }], options);
  assert.equal(item.spatial_score, 0);
  assert.equal(item.distance_m, null);
});

test("applies limit and minimum score", () => {
  const candidates = [0.9, 0.8, 0.7, 0.2].map((semantic, i) => ({
    _id: `c${i}`,
    semantic,
    geo: geoAt(0.0005),
  }));
  assert.equal(rankCandidates(candidates, { ...options, limit: 2 }).length, 2);
  assert.equal(
    rankCandidates(candidates, { ...options, minScore: 0.5 }).length,
    3,
  );
});
