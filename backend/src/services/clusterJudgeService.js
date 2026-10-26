import { GoogleGenAI } from "@google/genai";
import { buildJudgePrompt } from "../utils/judgePrompt.js";

let defaultClient;
const getDefaultClient = () => {
  defaultClient ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return defaultClient;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Calls run one after another with a pause, to stay under the per-minute limit.
let queue = Promise.resolve();
const schedule = (task, spacingMs, wait) => {
  const result = queue.then(task);
  queue = result.catch(() => {}).then(() => wait(spacingMs));
  return result;
};

// Asks the model, for every pair, whether both reports are about the same
// problem. pairs: [{ id, a: { title, description }, b: { title, description } }].
// Returns a Map id -> true | false; pairs the model did not answer are missing.
// Options allow injecting a fake client in tests.
export const judgeSamePairs = (
  pairs,
  { model, spacingMs = 0, client = getDefaultClient(), wait = sleep },
) =>
  schedule(
    async () => {
      const response = await client.models.generateContent({
        model,
        contents: buildJudgePrompt(pairs),
        config: { responseMimeType: "application/json", temperature: 0 },
      });
      const answers = JSON.parse(response.text);
      return new Map(
        answers
          .filter((answer) => typeof answer?.same === "boolean")
          .map((answer) => [answer.id, answer.same]),
      );
    },
    spacingMs,
    wait,
  );
