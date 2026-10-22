import test from "node:test";
import assert from "node:assert/strict";
import { findDistrictId } from "../src/utils/districtLookup.js";
import { DISTRICTS } from "../src/utils/districts.js";

const square = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0],
];

const features = [
  {
    properties: { district_id: "with_hole" },
    geometry: {
      type: "Polygon",
      coordinates: [square(0, 0, 10, 10), square(4, 4, 6, 6)],
    },
  },
  {
    properties: { district_id: "multi" },
    geometry: {
      type: "MultiPolygon",
      coordinates: [[square(20, 0, 30, 10)], [square(40, 0, 50, 10)]],
    },
  },
];

// Coordinates are [lng, lat] in GeoJSON, the function takes (lat, lng).
test("finds a point inside a polygon", () => {
  assert.equal(findDistrictId(1, 1, features), "with_hole");
});

test("ignores points inside a hole", () => {
  assert.equal(findDistrictId(5, 5, features), null);
});

test("searches every polygon of a MultiPolygon", () => {
  assert.equal(findDistrictId(5, 45, features), "multi");
  assert.equal(findDistrictId(5, 25, features), "multi");
});

test("returns null outside every polygon", () => {
  assert.equal(findDistrictId(5, 35, features), null);
});

test("real polygons: well-known points of Lviv", () => {
  assert.equal(findDistrictId(49.8419, 24.0315), "halytskyi"); // Rynok Square
  assert.equal(findDistrictId(49.8372, 24.0475), "lychakivskyi"); // Lychakiv cemetery
  assert.equal(findDistrictId(49.8397, 23.9944), "zaliznychnyi"); // railway station
  assert.equal(findDistrictId(49.852078, 24.0237848), "shevchenkivskyi"); // Chornovola Ave
  assert.equal(findDistrictId(49.8184397, 24.0417694), "sykhivskyi"); // Stusa St
});

test("real polygons: a point outside Lviv has no district", () => {
  assert.equal(findDistrictId(49.9, 24.1), null);
});

test("districts list has the six expected ids", () => {
  assert.deepEqual(DISTRICTS.map((d) => d.id).sort(), [
    "frankivskyi",
    "halytskyi",
    "lychakivskyi",
    "shevchenkivskyi",
    "sykhivskyi",
    "zaliznychnyi",
  ]);
});
