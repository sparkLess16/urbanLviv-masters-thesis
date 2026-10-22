import { test } from "node:test";
import assert from "node:assert/strict";
import { jitterPoint } from "../src/utils/jitter.js";
import { distanceMeters } from "../src/utils/geoMath.js";

const origin = { lat: 49.84, lng: 24.03 };

test("jitter stays within the requested distance range", () => {
  for (let i = 0; i < 200; i += 1) {
    const point = jitterPoint(origin.lat, origin.lng, `seed-${i}`, 5, 30);
    const distance = distanceMeters(origin, point);
    assert.ok(distance >= 4.9 && distance <= 30.1, `got ${distance}`);
  }
});

test("jitter is deterministic for the same seed", () => {
  const a = jitterPoint(origin.lat, origin.lng, "g01-1");
  const b = jitterPoint(origin.lat, origin.lng, "g01-1");
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, jitterPoint(origin.lat, origin.lng, "g01-2"));
});
