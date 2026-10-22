import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEvalSet } from "../src/utils/datasetValidation.js";

const group = {
  group_id: "g1",
  type_id: "roads",
  district_id: "halytskyi",
  street: "Test Street",
};

const makeReports = (count) =>
  Array.from({ length: count }, (_, i) => ({
    id: `g1-${i}`,
    group_id: "g1",
    title: "Title",
    description: "Description",
    location: "1 Test Street",
    priority_id: "medium",
  }));

test("accepts a valid set", () => {
  assert.deepEqual(
    validateEvalSet({ groups: [group], reports: makeReports(6) }),
    [],
  );
});

test("rejects a group smaller than the minimum", () => {
  const errors = validateEvalSet({ groups: [group], reports: makeReports(5) });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /need at least 6/);
});

test("rejects duplicate ids, unknown group and empty text", () => {
  const reports = makeReports(6);
  reports[1].id = reports[0].id;
  reports[2].group_id = "missing";
  reports[3].title = "  ";
  const errors = validateEvalSet({ groups: [group], reports }).join("\n");
  assert.match(errors, /duplicate report id/);
  assert.match(errors, /unknown group_id/);
  assert.match(errors, /title is empty/);
});

test("rejects unknown type, district and priority", () => {
  const reports = makeReports(6);
  reports[0].priority_id = "urgent";
  const errors = validateEvalSet({
    groups: [{ ...group, type_id: "water", district_id: "nowhere" }],
    reports,
  }).join("\n");
  assert.match(errors, /unknown type_id/);
  assert.match(errors, /unknown district_id/);
  assert.match(errors, /unknown priority_id/);
});
