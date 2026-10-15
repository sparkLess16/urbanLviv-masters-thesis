// Computes embeddings for reports that have none (or were embedded with a
// different model) and stores them.
//
// Usage (from the backend directory):
//   npm run backfill:embeddings -- --dry-run   # list reports, call nothing
//   npm run backfill:embeddings                # compute and write vectors
//
// Safe to re-run: only reports still missing a vector are processed, so a
// stopped run (e.g. daily quota exhausted) simply continues next time.
import dotenv from "dotenv";
import mongoose from "mongoose";
import Report from "../src/models/Report.js";
import {
  buildEmbeddingText,
  embedTexts,
  EMBEDDING_MODEL,
} from "../src/services/embeddingService.js";

dotenv.config();

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 20;
// Free tier allows 100 requests per minute; stay well below it.
const BATCH_DELAY_MS = 2000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const filter = {
    $or: [
      { embedding: { $exists: false } },
      { embedding_model: { $ne: EMBEDDING_MODEL } },
    ],
  };
  const reports = await Report.find(filter).select("title description");
  console.log(
    `${reports.length} report(s) need embeddings${DRY_RUN ? " (dry run)" : ""}`,
  );

  let done = 0;

  try {
    for (let i = 0; i < reports.length && !DRY_RUN; i += BATCH_SIZE) {
      const batch = reports.slice(i, i + BATCH_SIZE);
      const vectors = await embedTexts(
        batch.map(buildEmbeddingText),
        "document",
      );

      await Report.bulkWrite(
        batch.map((report, index) => ({
          updateOne: {
            filter: { _id: report._id },
            update: {
              $set: {
                embedding: vectors[index],
                embedding_model: EMBEDDING_MODEL,
              },
            },
            // Keep modified_dt unchanged.
            timestamps: false,
          },
        })),
      );

      done += batch.length;
      console.log(`  ✓ ${done}/${reports.length}`);
      await sleep(BATCH_DELAY_MS);
    }
  } catch (error) {
    console.log(`\nStopped after ${done} report(s): ${error.message}`);
    console.log("Re-run the script later to continue where it stopped.");
  }

  console.log(`\nDone: ${done} embedded.`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
