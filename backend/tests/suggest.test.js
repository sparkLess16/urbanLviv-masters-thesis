import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSuggestText,
  makeSnippet,
  suggestSimilar,
  toSuggestion,
} from "../src/services/suggestService.js";
import {
  createCachedEmbedder,
  normalizeText,
} from "../src/services/queryEmbeddingCache.js";
import { SUGGEST_SETTINGS } from "../src/config/duplicateThresholds.js";

const point = { lat: 49.84, lng: 24.03 };
const longText = {
  title: "Pothole on Zelena Street",
  description: "Big pothole near the bus stop",
};

// Fake dependencies that record calls.
const makeDeps = (overrides = {}) => {
  const calls = { hasNearby: 0, embed: 0, findSimilar: 0 };
  const deps = {
    hasNearby: async () => {
      calls.hasNearby += 1;
      return true;
    },
    embed: async () => {
      calls.embed += 1;
      return [1, 0];
    },
    findSimilar: async () => {
      calls.findSimilar += 1;
      return [
        {
          reportId: "r1",
          title: "Pothole",
          type_id: "roads",
          distance_m: 30,
          score: 0.8,
          semantic_score: 0.95,
        },
      ];
    },
    loadDetails: async () =>
      new Map([
        [
          "r1",
          {
            description: "A hole",
            created_dt: "2026-10-21",
            geo: { type: "Point", coordinates: [24.03, 49.84] },
          },
        ],
      ]),
    ...overrides,
  };
  return { deps, calls };
};

test("short text calls neither the database nor Gemini", async () => {
  const { deps, calls } = makeDeps();
  const result = await suggestSimilar(
    { title: "Hole", description: "", point },
    SUGGEST_SETTINGS,
    deps,
  );
  assert.deepEqual(result, { items: [], reason: "too_short" });
  assert.deepEqual(calls, { hasNearby: 0, embed: 0, findSimilar: 0 });
});

test("no location means no Gemini call", async () => {
  const { deps, calls } = makeDeps();
  const result = await suggestSimilar(
    { ...longText, point: null },
    SUGGEST_SETTINGS,
    deps,
  );
  assert.equal(result.reason, "no_location");
  assert.equal(calls.embed, 0);
});

test("nothing nearby: Gemini is not called", async () => {
  const { deps, calls } = makeDeps({ hasNearby: async () => false });
  const result = await suggestSimilar(
    { ...longText, point },
    SUGGEST_SETTINGS,
    deps,
  );
  assert.equal(result.reason, "nothing_nearby");
  assert.equal(calls.embed, 0);
  assert.equal(calls.findSimilar, 0);
});

test("a Gemini failure gives empty hints, not an error", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const { deps } = makeDeps({
      embed: async () => {
        throw new Error("429");
      },
    });
    const result = await suggestSimilar(
      { ...longText, point },
      SUGGEST_SETTINGS,
      deps,
    );
    assert.deepEqual(result, { items: [], reason: "unavailable" });
  } finally {
    console.error = originalError;
  }
});

test("returns shaped suggestions with a strong-match flag", async () => {
  const { deps } = makeDeps();
  const { items } = await suggestSimilar(
    { ...longText, point },
    SUGGEST_SETTINGS,
    deps,
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].match_percent, 95);
  assert.equal(items[0].description, "A hole");
  assert.equal(items[0].strong_match, true);
  assert.deepEqual(items[0].point, { lat: 49.84, lng: 24.03 });
});

test("a match is strong by the similarity of texts, within the radius", () => {
  const base = { reportId: "r", title: "t", type_id: "roads", score: 0.8 };
  // 100 m away: closeness must not lower the similarity that is compared.
  const near = toSuggestion(
    { ...base, semantic_score: 0.93, distance_m: 100 },
    null,
  );
  assert.equal(near.strong_match, true);
  assert.equal(near.match_percent, 93);
  assert.equal(
    toSuggestion({ ...base, semantic_score: 0.89, distance_m: 5 }, null)
      .strong_match,
    false,
  );
});

test("a near-identical text 300 m away is a hint but not a dialog", () => {
  const item = {
    reportId: "r",
    title: "t",
    type_id: "roads",
    score: 0.8,
    semantic_score: 0.97,
    distance_m: 300,
  };
  assert.equal(toSuggestion(item, null).strong_match, false);
  assert.equal(
    toSuggestion({ ...item, distance_m: 150 }, null).strong_match,
    true,
  );
});

test("a weaker or farther match is not strong", () => {
  const base = { reportId: "r", title: "t", type_id: "roads" };
  const settings = SUGGEST_SETTINGS;
  assert.equal(
    toSuggestion(
      { ...base, semantic_score: 0.6, score: 0.7, distance_m: 20 },
      null,
    ).strong_match,
    false,
  );
  assert.equal(
    toSuggestion(
      {
        ...base,
        semantic_score: 0.95,
        score: 0.9,
        distance_m: settings.dialogRadiusM + 1,
      },
      null,
    ).strong_match,
    false,
  );
});

test("builds the text from whatever is typed", () => {
  assert.equal(buildSuggestText({ title: " A ", description: " b " }), "A. b");
  assert.equal(buildSuggestText({ description: "only text" }), "only text");
  assert.equal(buildSuggestText({}), "");
});

test("snippets are cut with an ellipsis", () => {
  assert.equal(makeSnippet("short", 10), "short");
  assert.equal(makeSnippet("abcdefghij12345", 10), "abcdefghij…");
});

test("normalization ignores case and extra spaces", () => {
  assert.equal(normalizeText("  Big   POTHOLE "), "big pothole");
});

test("the cache embeds identical texts once, also when simultaneous", async () => {
  let calls = 0;
  const embed = createCachedEmbedder(async () => {
    calls += 1;
    return [calls];
  });

  const [a, b] = await Promise.all([
    embed("Big Pothole"),
    embed("big  pothole"),
  ]);
  const c = await embed(" BIG pothole ");

  assert.equal(calls, 1);
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
});

test("failed embeddings are not cached", async () => {
  let calls = 0;
  const embed = createCachedEmbedder(async () => {
    calls += 1;
    if (calls === 1) throw new Error("boom");
    return [1];
  });

  await assert.rejects(embed("some text"), /boom/);
  assert.deepEqual(await embed("some text"), [1]);
  assert.equal(calls, 2);
});

test("the cache drops the oldest entry over its limit", async () => {
  let calls = 0;
  const embed = createCachedEmbedder(async () => ++calls, 2);

  await embed("a");
  await embed("b");
  await embed("c"); // evicts "a"
  await embed("a"); // embedded again
  assert.equal(calls, 4);
});
