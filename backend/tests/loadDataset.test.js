import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildClone,
  featuresBounds,
  perturbVector,
  randomPointInDistricts,
} from "../src/utils/loadDataset.js";
import { mulberry32 } from "../src/utils/jitter.js";
import { dotProduct } from "../src/utils/geoMath.js";

// One square district, [lng, lat] corners.
const features = [
  {
    properties: { district_id: "d1" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [24.0, 49.8],
          [24.1, 49.8],
          [24.1, 49.9],
          [24.0, 49.9],
          [24.0, 49.8],
        ],
      ],
    },
  },
];

const unit = (length) => {
  const raw = Array.from({ length }, (_, i) => Math.sin(i + 1));
  const norm = Math.sqrt(raw.reduce((s, v) => s + v * v, 0));
  return raw.map((v) => v / norm);
};

test("perturbed vector keeps unit length and stays close to the source", () => {
  const source = unit(768);
  const clone = perturbVector(source, mulberry32(1), 0.02);
  const norm = Math.sqrt(clone.reduce((s, v) => s + v * v, 0));
  assert.ok(Math.abs(norm - 1) < 1e-9);
  const cosine = dotProduct(source, clone);
  assert.ok(cosine > 0.8 && cosine < 0.95, `cosine ${cosine}`);
});

test("random point lies inside a district polygon", () => {
  const bounds = featuresBounds(features);
  const random = mulberry32(7);
  for (let i = 0; i < 50; i += 1) {
    const point = randomPointInDistricts(features, random, bounds);
    assert.equal(point.district_id, "d1");
    assert.ok(point.lat >= 49.8 && point.lat <= 49.9);
    assert.ok(point.lng >= 24.0 && point.lng <= 24.1);
  }
});

test("clone is deterministic per index and copies the text fields", () => {
  const source = {
    title: "Pothole",
    description: "Big hole",
    location: "Zelena 50",
    type_id: "roads",
    priority_id: "high",
    embedding: unit(768),
    embedding_model: "m",
  };
  const make = (index) =>
    buildClone({ source, index, features, authorId: "a", now: 0 });
  assert.deepEqual(make(3), make(3));
  assert.notDeepEqual(make(3).embedding, make(4).embedding);
  assert.equal(make(3).title, "Pothole");
  assert.equal(make(3).geo.type, "Point");
  assert.ok(
    ["new", "in_progress", "resolved", "cancelled"].includes(make(3).status_id),
  );
});
