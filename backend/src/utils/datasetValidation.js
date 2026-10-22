import Report from "../models/Report.js";

export const MIN_GROUP_SIZE = 6;

export const DISTRICT_IDS = [
  "halytskyi",
  "frankivskyi",
  "lychakivskyi",
  "sykhivskyi",
  "shevchenkivskyi",
  "zaliznychnyi",
];

const TYPE_IDS = Report.schema.path("type_id").enumValues;
const PRIORITY_IDS = Report.schema.path("priority_id").enumValues;

const isFilledString = (value) =>
  typeof value === "string" && value.trim().length > 0;

// Returns a list of human-readable problems; empty list means the set is valid.
export const validateEvalSet = ({ groups, reports }) => {
  const errors = [];
  const groupIds = new Set();

  for (const group of groups) {
    if (groupIds.has(group.group_id)) {
      errors.push(`duplicate group id ${group.group_id}`);
    }
    groupIds.add(group.group_id);

    if (!TYPE_IDS.includes(group.type_id)) {
      errors.push(`${group.group_id}: unknown type_id "${group.type_id}"`);
    }
    if (!DISTRICT_IDS.includes(group.district_id)) {
      errors.push(
        `${group.group_id}: unknown district_id "${group.district_id}"`,
      );
    }
    if (!isFilledString(group.street)) {
      errors.push(`${group.group_id}: street is empty`);
    }
  }

  const reportIds = new Set();
  const sizes = new Map([...groupIds].map((id) => [id, 0]));

  for (const report of reports) {
    if (reportIds.has(report.id)) {
      errors.push(`duplicate report id ${report.id}`);
    }
    reportIds.add(report.id);

    if (!groupIds.has(report.group_id)) {
      errors.push(`${report.id}: unknown group_id "${report.group_id}"`);
    } else {
      sizes.set(report.group_id, sizes.get(report.group_id) + 1);
    }

    for (const field of ["title", "description", "location"]) {
      if (!isFilledString(report[field])) {
        errors.push(`${report.id}: ${field} is empty`);
      }
    }
    if (!PRIORITY_IDS.includes(report.priority_id)) {
      errors.push(`${report.id}: unknown priority_id "${report.priority_id}"`);
    }
  }

  for (const [groupId, size] of sizes) {
    if (size < MIN_GROUP_SIZE) {
      errors.push(
        `${groupId}: only ${size} report(s), need at least ${MIN_GROUP_SIZE}`,
      );
    }
  }

  return errors;
};
