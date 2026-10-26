import { test } from "node:test";
import assert from "node:assert/strict";
import { getJudgeSettings } from "../src/config/clusterJudge.js";
import { judgeSamePairs } from "../src/services/clusterJudgeService.js";
import { combineVerdicts, judgePairsFor } from "../src/utils/clusterMath.js";

// Unit vectors with a chosen cosine to [1, 0].
const withCosine = (cosine) => [cosine, Math.sqrt(1 - cosine ** 2)];
const zone = { low: 0.83, high: 0.9, k: 3 };

test("no judged pairs when the closest member is outside the grey zone", () => {
  const member = { embedding: [1, 0] };
  const tooClose = { members: [{ embedding: withCosine(0.95) }] };
  const tooFar = { members: [{ embedding: withCosine(0.6) }] };
  assert.deepEqual(judgePairsFor(member, tooClose, zone), []);
  assert.deepEqual(judgePairsFor(member, tooFar, zone), []);
});

test("takes the k closest members that are inside the grey zone", () => {
  const member = { embedding: [1, 0] };
  const inside = [0.89, 0.87, 0.85, 0.84].map((c) => ({
    embedding: withCosine(c),
  }));
  const cluster = { members: [{ embedding: withCosine(0.5) }, ...inside] };
  const pairs = judgePairsFor(member, cluster, zone);
  assert.deepEqual(pairs, inside.slice(0, 3));
});

test("a member above the zone does not hide the closest one in it", () => {
  const member = { embedding: [1, 0] };
  const cluster = {
    members: [{ embedding: withCosine(0.95) }, { embedding: withCosine(0.86) }],
  };
  assert.deepEqual(judgePairsFor(member, cluster, zone), []);
});

test("verdicts combine by any or by majority", () => {
  assert.equal(combineVerdicts([], "any"), null);
  assert.equal(combineVerdicts([false, true, false], "any"), true);
  assert.equal(combineVerdicts([false, true, false], "majority"), false);
  assert.equal(combineVerdicts([true, true, false], "majority"), true);
});

test("the judge settings follow the environment", () => {
  assert.equal(getJudgeSettings({ GEMINI_API_KEY: "x" }).enabled, true);
  assert.equal(getJudgeSettings({}).enabled, false);
  assert.equal(
    getJudgeSettings({ GEMINI_API_KEY: "x", CLUSTER_JUDGE: "off" }).enabled,
    false,
  );
  assert.equal(getJudgeSettings({ CLUSTER_JUDGE_MODEL: "m" }).model, "m");
});

const pair = (id) => ({
  id,
  a: { title: "a", description: "a" },
  b: { title: "b", description: "b" },
});

test("judgeSamePairs returns the answers by pair id", async () => {
  const client = {
    models: {
      generateContent: async () => ({
        text: JSON.stringify([
          { id: 1, same: true },
          { id: 2, same: false },
          { id: 3, same: "maybe" },
        ]),
      }),
    },
  };
  const answers = await judgeSamePairs([pair(1), pair(2), pair(3)], {
    model: "m",
    client,
    wait: async () => {},
  });
  assert.deepEqual(
    [...answers],
    [
      [1, true],
      [2, false],
    ],
  );
});

test("a failed call rejects but does not block the next one", async () => {
  let calls = 0;
  const client = {
    models: {
      generateContent: async () => {
        calls += 1;
        if (calls === 1) throw new Error("quota");
        return { text: JSON.stringify([{ id: 1, same: true }]) };
      },
    },
  };
  const options = { model: "m", client, wait: async () => {} };
  await assert.rejects(judgeSamePairs([pair(1)], options), /quota/);
  const answers = await judgeSamePairs([pair(1)], options);
  assert.equal(answers.get(1), true);
});
