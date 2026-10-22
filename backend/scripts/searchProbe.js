// Manual check of the vector index: embeds a phrase and prints the closest
// reports. A service utility only, the real search endpoint comes in FR-01.
//
// Usage (from the backend directory):
//   npm run search:probe -- "broken lamp near my house"
//
// Scores use Atlas's (1 + cosine) / 2 scale.
import dotenv from "dotenv";
import mongoose from "mongoose";
import Report from "../src/models/Report.js";
import { embedText } from "../src/services/embeddingService.js";

dotenv.config();

// With --experiment the search runs in the experiment database.
const EXPERIMENT = process.argv.includes("--experiment");
const DB_NAME = process.env.EXPERIMENT_DB_NAME || "urbanlviv_experiments";

const phrase = process.argv
  .slice(2)
  .filter((arg) => arg !== "--experiment")
  .join(" ")
  .trim();
const LIMIT = 5;

const run = async () => {
  if (!phrase) {
    console.log('Usage: npm run search:probe -- "your phrase"');
    return;
  }

  await mongoose.connect(
    process.env.MONGO_URI,
    EXPERIMENT ? { dbName: DB_NAME } : {},
  );
  console.log(`Database: ${mongoose.connection.name}`);
  const queryVector = await embedText(phrase, "query");

  const results = await Report.aggregate([
    {
      $vectorSearch: {
        index: "reports_embedding_index",
        path: "embedding",
        queryVector,
        numCandidates: 100,
        limit: LIMIT,
      },
    },
    {
      $project: {
        _id: 0,
        title: 1,
        type_id: 1,
        district_id: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]);

  console.log(`Closest reports to "${phrase}":`);
  for (const r of results) {
    console.log(
      `  ${r.score.toFixed(4)}  [${r.type_id}, ${r.district_id}]  ${r.title}`,
    );
  }
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
