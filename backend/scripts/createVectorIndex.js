// One-time script: creates the Atlas Vector Search index on reports.embedding.
//
// Usage (from the backend directory):
//   npm run index:vector
//
// Safe to re-run: does nothing if the index already exists. Index building is
// asynchronous, so the script waits until the index becomes queryable.
import dotenv from "dotenv";
import mongoose from "mongoose";
import Report from "../src/models/Report.js";
import { EMBEDDING_DIMENSIONS } from "../src/services/embeddingService.js";

dotenv.config();

// With --experiment the index is created in the experiment database instead of
// the working one.
const EXPERIMENT = process.argv.includes("--experiment");
const DB_NAME = process.env.EXPERIMENT_DB_NAME || "urbanlviv_experiments";

const INDEX_NAME = "reports_embedding_index";
const POLL_INTERVAL_MS = 5000;
const MAX_WAIT_MS = 5 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  await mongoose.connect(
    process.env.MONGO_URI,
    EXPERIMENT ? { dbName: DB_NAME } : {},
  );
  console.log(`Database: ${mongoose.connection.name}`);
  const collection = Report.collection;

  const existing = await collection.listSearchIndexes(INDEX_NAME).toArray();
  if (existing.length > 0) {
    console.log(
      `Index "${INDEX_NAME}" already exists (status: ${existing[0].status}).`,
    );
    await mongoose.disconnect();
    return;
  }

  await collection.createSearchIndex({
    name: INDEX_NAME,
    type: "vectorSearch",
    definition: {
      fields: [
        {
          type: "vector",
          path: "embedding",
          numDimensions: EMBEDDING_DIMENSIONS,
          similarity: "cosine",
        },
        { type: "filter", path: "status_id" },
        { type: "filter", path: "type_id" },
        { type: "filter", path: "district_id" },
      ],
    },
  });
  console.log(`Index "${INDEX_NAME}" created, waiting until queryable...`);

  const startedAt = Date.now();
  while (Date.now() - startedAt < MAX_WAIT_MS) {
    const [index] = await collection.listSearchIndexes(INDEX_NAME).toArray();
    if (index?.queryable) {
      console.log("Index is queryable.");
      await mongoose.disconnect();
      return;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  console.log("Timed out: check the index status in the Atlas UI.");
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
