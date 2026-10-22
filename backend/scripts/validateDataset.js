// Checks data/eval/eval_set.json before it is loaded anywhere.
//
// Usage (from the backend directory):
//   npm run validate:dataset
import fs from "node:fs";
import { validateEvalSet } from "../src/utils/datasetValidation.js";

const FILE = new URL("../data/eval/eval_set.json", import.meta.url);

const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
const errors = validateEvalSet(data);

console.log(`${data.groups.length} group(s), ${data.reports.length} report(s)`);

if (errors.length > 0) {
  console.log(`\n${errors.length} problem(s):`);
  errors.forEach((error) => console.log(`  ✗ ${error}`));
  process.exit(1);
}

console.log("Dataset is valid.");
