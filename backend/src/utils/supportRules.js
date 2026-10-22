import { buildGeoPoint, geoToLatLng } from "./geo.js";
import { distanceMeters } from "./geoMath.js";

export const MAX_SUPPORT_DISTANCE_M = 1000;
export const MAX_SUPPORT_COMMENT_LENGTH = 500;
export const SUPPORT_VIA = ["hint", "submit_dialog"];

const CLOSED_STATUSES = new Set(["resolved", "cancelled"]);

const isBlank = (value) =>
  value === undefined || value === null || value === "";

// Returns { status, message } when the user may not support the report.
export const checkSupportAllowed = (report, userId) => {
  if (String(report.created_by) === String(userId)) {
    return { status: 403, message: "You cannot support your own report" };
  }
  if (CLOSED_STATUSES.has(report.status_id)) {
    return { status: 409, message: "This report is already closed" };
  }
  return null;
};

// Validates the body of POST /reports/:id/support against the report.
// Returns { value: { comment, geo, distance_m, via, score } } or
// { error: { status, message } }. Pure: no database.
export const parseSupportInput = (body = {}, report) => {
  const fail = (message) => ({ error: { status: 400, message } });

  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  if (comment.length > MAX_SUPPORT_COMMENT_LENGTH) {
    return fail(
      `Comment must be at most ${MAX_SUPPORT_COMMENT_LENGTH} characters`,
    );
  }

  const via = isBlank(body.via) ? undefined : body.via;
  if (via !== undefined && !SUPPORT_VIA.includes(via)) {
    return fail(`via must be one of: ${SUPPORT_VIA.join(", ")}`);
  }

  let score;
  if (!isBlank(body.score)) {
    score = Number(body.score);
    if (!Number.isFinite(score) || score < 0 || score > 1) {
      return fail("score must be a number between 0 and 1");
    }
  }

  let geo;
  let distance_m;
  if (!isBlank(body.lat) || !isBlank(body.lng)) {
    const point = buildGeoPoint(body.lat, body.lng);
    if (point.error) return fail(point.error);
    geo = point.geo;

    const reportPoint = geoToLatLng(report.geo);
    if (reportPoint) {
      const distance = distanceMeters(geoToLatLng(geo), reportPoint);
      if (distance > MAX_SUPPORT_DISTANCE_M) {
        return fail(
          "This point is more than 1 km from the report, it may be a different problem",
        );
      }
      distance_m = Math.round(distance);
    }
  }

  return { value: { comment, geo, distance_m, via, score } };
};

// Turns raw query results into a Map reportId -> { count, mine }.
//   counts: [{ _id: reportId, count }]   (aggregate, kind "support")
//   mineDocs: [{ report_id }]            (the user's own supports)
export const buildSupportInfo = (reportIds, counts, mineDocs) => {
  const info = new Map(
    reportIds.map((id) => [String(id), { count: 0, mine: false }]),
  );
  for (const { _id, count } of counts) {
    const entry = info.get(String(_id));
    if (entry) entry.count = count;
  }
  for (const { report_id } of mineDocs) {
    const entry = info.get(String(report_id));
    if (entry) entry.mine = true;
  }
  return info;
};
