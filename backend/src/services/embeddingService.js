import { GoogleGenAI } from "@google/genai";

export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS =
  Number(process.env.EMBEDDING_DIMENSIONS) || 768;

// "document" for stored reports and duplicate hints (report vs report), "query"
// for free-text search.
const TASK_TYPES = {
  document: "RETRIEVAL_DOCUMENT",
  query: "RETRIEVAL_QUERY",
};

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1000;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

let defaultClient;
const getDefaultClient = () => {
  defaultClient ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return defaultClient;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Location and type are left out on purpose: the spatial part of the
// similarity score already covers where, and type may be chosen wrongly.
export const buildEmbeddingText = ({ title, description }) =>
  `${title}. ${description}`;

export const normalizeVector = (values) => {
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) throw new Error("Cannot normalize a zero vector");
  return values.map((v) => v / norm);
};

const isRetryable = (error) => RETRYABLE_STATUSES.has(error?.status);

// Embeds several texts in one request. Options allow injecting a fake client
// and delay function in tests.
export const embedTexts = async (
  texts,
  role = "document",
  {
    client = getDefaultClient(),
    wait = sleep,
    model = EMBEDDING_MODEL,
    dimensions = EMBEDDING_DIMENSIONS,
  } = {},
) => {
  const taskType = TASK_TYPES[role];
  if (!taskType) throw new Error(`Unknown embedding role: ${role}`);

  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await client.models.embedContent({
        model,
        contents: texts,
        config: { taskType, outputDimensionality: dimensions },
      });

      const vectors = response.embeddings?.map((e) => e.values) ?? [];
      if (vectors.length !== texts.length) {
        throw new Error(
          `Expected ${texts.length} embeddings, got ${vectors.length}`,
        );
      }
      return vectors.map((values) => {
        if (values.length !== dimensions) {
          throw new Error(
            `Expected ${dimensions} dimensions, got ${values.length}`,
          );
        }
        return normalizeVector(values);
      });
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isRetryable(error)) throw error;
      await wait(BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }
};

export const embedText = async (text, role = "document", options) => {
  const [vector] = await embedTexts([text], role, options);
  return vector;
};

// Returns { embedding, embedding_model } for a report, or null when Gemini
// fails. A report must still be saved without a vector; backfill adds it later.
export const embedReport = async (report, options) => {
  try {
    const embedding = await embedText(
      buildEmbeddingText(report),
      "document",
      options,
    );
    return { embedding, embedding_model: EMBEDDING_MODEL };
  } catch (error) {
    console.error("Embedding error:", error.message);
    return null;
  }
};
