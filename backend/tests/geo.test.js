import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGeoPoint, geoToLatLng } from "../src/utils/geo.js";

test("builds a GeoJSON point in [lng, lat] order", () => {
  const { geo, error } = buildGeoPoint("49.8419", "24.0315");
  assert.equal(error, undefined);
  assert.deepEqual(geo, { type: "Point", coordinates: [24.0315, 49.8419] });
});

test("rejects missing coordinates", () => {
  assert.ok(buildGeoPoint(undefined, 24.03).error);
  assert.ok(buildGeoPoint(49.84, "").error);
  assert.ok(buildGeoPoint(null, null).error);
});

test("rejects non-numeric coordinates", () => {
  assert.ok(buildGeoPoint("abc", "24.03").error);
});

test("rejects out-of-range coordinates", () => {
  assert.ok(buildGeoPoint(100, 24.03).error);
  assert.ok(buildGeoPoint(49.84, 200).error);
});

test("rejects points outside of Lviv", () => {
  assert.match(buildGeoPoint(50.45, 30.52).error, /outside of Lviv/);
});

test("geoToLatLng flattens a stored point and tolerates missing geo", () => {
  assert.deepEqual(
    geoToLatLng({ type: "Point", coordinates: [24.03, 49.84] }),
    {
      lat: 49.84,
      lng: 24.03,
    },
  );
  assert.equal(geoToLatLng(undefined), null);
  assert.equal(geoToLatLng({ coordinates: [] }), null);
});
