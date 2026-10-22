import test from "node:test";
import assert from "node:assert/strict";
import { SUPPORT_WEIGHT, computeTopScore } from "../src/utils/topScore.js";

test("keeps the old formula when there are no supports", () => {
  assert.equal(
    computeTopScore({
      priorityId: "high",
      likes: 4,
      dislikes: 1,
      comments: 2,
    }),
    30 + 8 - 1 + 2,
  );
});

test("each supporter adds the same weight", () => {
  const base = { priorityId: "medium", likes: 1, dislikes: 0, comments: 0 };
  const without = computeTopScore(base);
  assert.equal(
    computeTopScore({ ...base, supports: 1 }) - without,
    SUPPORT_WEIGHT,
  );
  assert.equal(
    computeTopScore({ ...base, supports: 4 }) - without,
    4 * SUPPORT_WEIGHT,
  );
});

test("an unknown priority counts as zero", () => {
  assert.equal(computeTopScore({ priorityId: "weird", likes: 1 }), 2);
});
