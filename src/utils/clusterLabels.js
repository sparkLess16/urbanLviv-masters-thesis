// What each value of the Status filter means (cluster status in brackets).
export const STATUS_FILTERS = [
  {
    value: "open",
    label: "Open",
    hint: "At least one report is new or in progress",
  },
  { value: "resolved", label: "Resolved", hint: "Every report is done" },
  { value: "closed", label: "Closed", hint: "Rejected or cancelled reports" },
  { value: "all", label: "All statuses", hint: "Open, resolved and closed" },
];

// Cluster status from the API -> the word the user sees.
export const CLUSTER_STATUS_LABELS = {
  active: "Open",
  resolved: "Resolved",
  closed: "Closed",
};

export const REPORT_STATUS_LABELS = {
  new: "New",
  in_progress: "In progress",
  resolved: "Resolved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

// District names come with a leading emoji ("🏛 Halytskyi"); drop it.
export const plainDistrictName = (name = "") =>
  name.replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, "");

// "1 report", "4 reports"
export const reportsLabel = (count) =>
  `${count} ${count === 1 ? "report" : "reports"}`;

// Marker diameter grows with the number of reports, up to 10.
export const markerSize = (count) => 30 + Math.min(count, 10) * 3;
