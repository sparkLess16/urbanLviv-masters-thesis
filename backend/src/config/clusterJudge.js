// Settings of the LLM judge for borderline cluster decisions (FR-03).
// Chosen on the tune groups of the evaluation set and checked on the test
// groups: grey zone 0.83-0.90 of text similarity, the 3 closest members of a
// candidate cluster, one "same problem" answer is enough.
//
// The judge only runs when a candidate cluster has a member in the grey zone,
// asks Gemini once per new report, and never blocks clustering: on any error
// the score formula decides, as without the judge.
//   CLUSTER_JUDGE=off          turns the judge off
//   CLUSTER_JUDGE_MODEL=...    changes the model
// The free tier of the default model allows 15 requests per minute and 500
// per day, so calls are spaced out.
export const getJudgeSettings = (env = process.env) => ({
  enabled: env.CLUSTER_JUDGE !== "off" && Boolean(env.GEMINI_API_KEY),
  model: env.CLUSTER_JUDGE_MODEL || "gemini-3.5-flash-lite",
  low: 0.83,
  high: 0.9,
  k: 3,
  vote: "any",
  spacingMs: 4500,
});
