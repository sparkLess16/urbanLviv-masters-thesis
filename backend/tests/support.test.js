import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SUPPORT_DISTANCE_M,
  buildSupportInfo,
  checkSupportAllowed,
  parseSupportInput,
} from "../src/utils/supportRules.js";

const report = {
  created_by: "author",
  status_id: "new",
  geo: { type: "Point", coordinates: [24.0315, 49.8419] },
};

test("a user cannot support their own report", () => {
  const denied = checkSupportAllowed(report, "author");
  assert.equal(denied.status, 403);
});

test("resolved and cancelled reports cannot be supported", () => {
  for (const status_id of ["resolved", "cancelled"]) {
    const denied = checkSupportAllowed({ ...report, status_id }, "other");
    assert.equal(denied.status, 409, status_id);
  }
});

test("another user can support a new or in-progress report", () => {
  assert.equal(checkSupportAllowed(report, "other"), null);
  assert.equal(
    checkSupportAllowed({ ...report, status_id: "in_progress" }, "other"),
    null,
  );
});

test("support without text and point is valid", () => {
  const { value, error } = parseSupportInput({}, report);
  assert.equal(error, undefined);
  assert.equal(value.comment, "");
  assert.equal(value.geo, undefined);
});

test("comment is trimmed and its length limited", () => {
  assert.equal(
    parseSupportInput({ comment: "  still there  " }, report).value.comment,
    "still there",
  );
  assert.equal(
    parseSupportInput({ comment: "x".repeat(501) }, report).error.status,
    400,
  );
});

test("a point near the report is accepted with its distance", () => {
  const { value } = parseSupportInput(
    { lat: 49.8423, lng: 24.0315, via: "hint", score: 0.8 },
    report,
  );
  assert.deepEqual(value.geo.coordinates, [24.0315, 49.8423]);
  assert.ok(value.distance_m > 30 && value.distance_m < 60);
  assert.equal(value.via, "hint");
  assert.equal(value.score, 0.8);
});

test("a point farther than 1 km is rejected", () => {
  // about 1.5 km north of the report
  const { error } = parseSupportInput({ lat: 49.8554, lng: 24.0315 }, report);
  assert.equal(error.status, 400);
  assert.match(error.message, /1 km/);
  assert.equal(MAX_SUPPORT_DISTANCE_M, 1000);
});

test("a point outside Lviv is rejected", () => {
  assert.equal(
    parseSupportInput({ lat: 50.45, lng: 30.52 }, report).error.status,
    400,
  );
});

test("only one of lat and lng is rejected", () => {
  assert.equal(parseSupportInput({ lat: 49.84 }, report).error.status, 400);
});

test("unknown via and out-of-range score are rejected", () => {
  assert.equal(parseSupportInput({ via: "magic" }, report).error.status, 400);
  assert.equal(parseSupportInput({ score: 1.5 }, report).error.status, 400);
});

test("buildSupportInfo counts supports and marks the user's own", () => {
  const info = buildSupportInfo(
    ["a", "b", "c"],
    [
      { _id: "a", count: 3 },
      { _id: "b", count: 1 },
    ],
    [{ report_id: "b" }],
  );
  assert.deepEqual(info.get("a"), { count: 3, mine: false });
  assert.deepEqual(info.get("b"), { count: 1, mine: true });
  assert.deepEqual(info.get("c"), { count: 0, mine: false });
});
