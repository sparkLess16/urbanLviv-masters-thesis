// One-off: merges User.firstName + lastName into a single name field.
// Idempotent: users that already have a name are skipped. Makes no Gemini requests.
//
// Usage (from the backend directory):
//   npm run migrate:user-names -- --dry-run   # count only, write nothing
//   npm run migrate:user-names                # main database
import dotenv from "dotenv";
import mongoose from "mongoose";
import { mergeName } from "../src/utils/userName.js";

dotenv.config();

const dryRun = process.argv.includes("--dry-run");

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Database: ${mongoose.connection.name}`);

  const users = mongoose.connection.collection("users");
  const pending = await users
    .find({ name: { $exists: false } })
    .project({ firstName: 1, lastName: 1, email: 1 })
    .toArray();

  let updated = 0;
  for (const user of pending) {
    const name = mergeName(user) || user.email.split("@")[0];
    if (!dryRun) {
      await users.updateOne(
        { _id: user._id },
        { $set: { name }, $unset: { firstName: "", lastName: "" } },
      );
    }
    updated += 1;
    console.log(`${dryRun ? "would set" : "set"}: ${user._id} -> "${name}"`);
  }
  console.log(`${updated} user(s) ${dryRun ? "to update" : "updated"}`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
