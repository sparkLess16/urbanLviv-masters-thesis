import { DISTRICT_IDS } from "./districts.js";

// Status filter of the cluster list. "open" is the cluster status "active":
// at least one report is new or in progress.
const STATUS_FILTERS = {
  open: "active",
  resolved: "resolved",
  closed: "closed",
};

// Turns the query string of GET /api/clusters into a Mongo filter.
// district_id: a known district or "all"; status: open (default), resolved,
// closed or all. Returns { filter } or { error }.
export const parseClusterQuery = ({ district_id, status = "open" } = {}) => {
  const filter = {};

  if (district_id && district_id !== "all") {
    if (!DISTRICT_IDS.includes(district_id)) {
      return { error: "Unknown district_id" };
    }
    filter.district_id = district_id;
  }

  if (status !== "all") {
    if (!(status in STATUS_FILTERS)) {
      return { error: "status must be open, resolved, closed or all" };
    }
    filter.status = STATUS_FILTERS[status];
  }

  return { filter };
};
