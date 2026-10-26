import fs from "node:fs";

const DATA_FILE = new URL("../../data/eval/eval_set.json", import.meta.url);

// Map group_id -> "tune" | "test", read from the evaluation set.
export const loadSplitMap = () =>
  new Map(
    JSON.parse(fs.readFileSync(DATA_FILE, "utf8")).groups.map((group) => [
      group.group_id,
      group.split,
    ]),
  );

// Keeps the reports whose group belongs to the requested split.
// split: "tune", "test" or undefined/"all" for everything.
export const filterBySplit = (reports, groupOf, split) => {
  if (!split || split === "all") return reports;
  const splitOf = loadSplitMap();
  return reports.filter(
    (report) => splitOf.get(groupOf.get(String(report._id))) === split,
  );
};
