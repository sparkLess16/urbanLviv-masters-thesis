// One-time script: creates the indexes of the comments collection, in
// particular the unique "one support per person per report" index.
//
// Usage (from the backend directory):
//   npm run index:comments
//
// Safe to re-run: existing indexes are left as they are.
import dotenv from "dotenv";
import mongoose from "mongoose";
import Comment from "../src/models/Comment.js";

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Database: ${mongoose.connection.name}`);

  await Comment.createIndexes();

  const indexes = await Comment.collection.indexes();
  for (const index of indexes) {
    console.log(`  ${index.name}${index.unique ? " (unique)" : ""}`);
  }
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
