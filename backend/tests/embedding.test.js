import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildEmbeddingText,
  embedReport,
  embedText,
  embedTexts,
  normalizeVector,
} from "../src/services/embeddingService.js";

const DIMS = 4;
const noWait = async () => {};

const fakeClient = (handler) => ({
  models: { embedContent: handler },
});

const opts = (client) => ({ client, wait: noWait, dimensions: DIMS });

test("builds embedding text from title and description only", () => {
  const text = buildEmbeddingText({
    title: "Pothole",
    description: "Deep hole on the road",
    location: "Zelena St",
    type_id: "roads",
  });
  assert.equal(text, "Pothole. Deep hole on the road");
});

test("normalizes a vector to unit length", () => {
  const result = normalizeVector([3, 4]);
  assert.deepEqual(result, [0.6, 0.8]);
  assert.throws(() => normalizeVector([0, 0]));
});

test("returns normalized vectors of the requested size", async () => {
  const client = fakeClient(async () => ({
    embeddings: [{ values: [2, 0, 0, 0] }],
  }));
  const vector = await embedText("text", "document", opts(client));
  assert.deepEqual(vector, [1, 0, 0, 0]);
});

test("maps role to Gemini task type", async () => {
  const seen = [];
  const client = fakeClient(async (args) => {
    seen.push(args.config.taskType);
    return { embeddings: [{ values: [1, 0, 0, 0] }] };
  });
  await embedText("a", "document", opts(client));
  await embedText("a", "query", opts(client));
  assert.deepEqual(seen, ["RETRIEVAL_DOCUMENT", "RETRIEVAL_QUERY"]);
  await assert.rejects(embedText("a", "bogus", opts(client)));
});

test("rejects a wrong dimension count", async () => {
  const client = fakeClient(async () => ({
    embeddings: [{ values: [1, 0] }],
  }));
  await assert.rejects(embedText("a", "document", opts(client)), /dimensions/);
});

test("retries on temporary errors then succeeds", async () => {
  let calls = 0;
  const client = fakeClient(async () => {
    calls += 1;
    if (calls < 3) throw Object.assign(new Error("busy"), { status: 503 });
    return { embeddings: [{ values: [1, 0, 0, 0] }] };
  });
  const [vector] = await embedTexts(["a"], "document", opts(client));
  assert.equal(calls, 3);
  assert.deepEqual(vector, [1, 0, 0, 0]);
});

test("does not retry non-retryable errors", async () => {
  let calls = 0;
  const client = fakeClient(async () => {
    calls += 1;
    throw Object.assign(new Error("bad key"), { status: 400 });
  });
  await assert.rejects(embedText("a", "document", opts(client)), /bad key/);
  assert.equal(calls, 1);
});

test("gives up after the maximum number of attempts", async () => {
  let calls = 0;
  const client = fakeClient(async () => {
    calls += 1;
    throw Object.assign(new Error("quota"), { status: 429 });
  });
  await assert.rejects(embedText("a", "document", opts(client)), /quota/);
  assert.equal(calls, 4);
});

test("embedReport returns null instead of throwing on failure", async () => {
  const client = fakeClient(async () => {
    throw Object.assign(new Error("bad key"), { status: 400 });
  });
  const originalError = console.error;
  console.error = () => {};
  try {
    const result = await embedReport(
      { title: "a", description: "b" },
      opts(client),
    );
    assert.equal(result, null);
  } finally {
    console.error = originalError;
  }
});
