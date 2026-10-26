// Prompt for the LLM judge: are two citizen reports about the SAME problem?
// pairs: [{ id, a: { title, description }, b: { title, description } }]
export const buildJudgePrompt = (
  pairs,
) => `You help a city administration decide whether two citizen reports describe the SAME real-world problem at the same place, so that they can be grouped together.

Rules:
- "same" is true only when both reports are about the same specific problem (for example the same broken lamp or the same pile of waste).
- "same" is false when the problems differ, even if the topic and the place are similar (for example a flickering streetlight and construction floodlights, or overflowing bins and dumped furniture).
- Different wording, typos, tone or level of detail do not make problems different.

For each numbered pair answer with a JSON array, one object per pair: {"id": <number>, "same": true or false}. Return only the array.

${pairs
  .map(
    (pair) =>
      `Pair ${pair.id}\nA: ${pair.a.title}. ${pair.a.description}\nB: ${pair.b.title}. ${pair.b.description}`,
  )
  .join("\n\n")}`;

// Key of a pair in the judge table: dataset ids in alphabetical order.
export const pairKey = (idA, idB) =>
  idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
