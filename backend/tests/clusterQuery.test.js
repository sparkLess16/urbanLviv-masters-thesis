import test from "node:test";
import assert from "node:assert/strict";
import { parseClusterQuery } from "../src/utils/clusterQuery.js";
import { toClusterItem, toClusterReport } from "../src/utils/clusterView.js";

test("no query means all districts, open clusters", () => {
  assert.deepEqual(parseClusterQuery({}), { filter: { status: "active" } });
  assert.deepEqual(parseClusterQuery(undefined), {
    filter: { status: "active" },
  });
});

test("district and status map to a Mongo filter", () => {
  assert.deepEqual(
    parseClusterQuery({ district_id: "halytskyi", status: "resolved" }),
    { filter: { district_id: "halytskyi", status: "resolved" } },
  );
  assert.deepEqual(parseClusterQuery({ district_id: "all", status: "all" }), {
    filter: {},
  });
  assert.equal(parseClusterQuery({ status: "closed" }).filter.status, "closed");
});

test("unknown district or status is an error", () => {
  assert.ok(parseClusterQuery({ district_id: "atlantis" }).error);
  assert.ok(parseClusterQuery({ status: "active" }).error);
});

test("cluster item flattens the centroid and names the cluster", () => {
  const item = toClusterItem(
    {
      _id: "c1",
      type_id: "roads",
      district_id: "halytskyi",
      status: "active",
      reports_count: 4,
      responsible_service: "Department of Housing and Infrastructure",
      centroid: { coordinates: [24.03, 49.84] },
    },
    { title: "Potholes", inProgressCount: 1 },
  );
  assert.deepEqual(item.centroid, { lat: 49.84, lng: 24.03 });
  assert.equal(item.title, "Potholes");
  assert.equal(item.in_progress_count, 1);
});

test("member report keeps only what the map popup needs", () => {
  const report = toClusterReport({
    _id: "r1",
    title: "Hole",
    status_id: "new",
    type_id: "roads",
    created_dt: "2026-10-01",
    geo: { type: "Point", coordinates: [24.03, 49.84] },
    description: "not exposed",
  });
  assert.deepEqual(report.point, { lat: 49.84, lng: 24.03 });
  assert.equal(report.description, undefined);
});
