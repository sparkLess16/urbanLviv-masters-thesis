import {
  combineScores,
  distanceMeters,
  dotProduct,
  spatialScore,
} from "./geoMath.js";

// Starting values; tau is tuned on the evaluation set (npm run eval:clustering).
export const CLUSTER_DEFAULTS = { alpha: 0.7, radiusM: 500, tau: 0.8 };

// A cluster stays open to new reports while at least one member is unresolved.
const ACTIVE_STATUSES = ["new", "in_progress"];

const normalize = (vector) => {
  const norm = Math.sqrt(dotProduct(vector, vector));
  return norm === 0 ? vector : vector.map((value) => value / norm);
};

// Centroid of members: mean position and mean vector. Members without
// coordinates or without a vector are skipped for that part.
// member: { point: { lat, lng } | null, embedding: number[] | null }
// Returns { point, embedding } where embedding is a unit vector.
export const computeCentroid = (members) => {
  const located = members.filter((member) => member.point);
  const embedded = members.filter((member) => member.embedding);

  const point = located.length
    ? {
        lat: located.reduce((sum, m) => sum + m.point.lat, 0) / located.length,
        lng: located.reduce((sum, m) => sum + m.point.lng, 0) / located.length,
      }
    : null;

  let embedding = null;
  if (embedded.length) {
    const sum = new Array(embedded[0].embedding.length).fill(0);
    for (const member of embedded) {
      member.embedding.forEach((value, i) => {
        sum[i] += value;
      });
    }
    embedding = normalize(sum);
  }

  return { point, embedding };
};

// Same formula as similar-report search: alpha * semantic + (1 - alpha) * spatial.
export const scoreAgainstCluster = (
  report,
  cluster,
  { alpha, radiusM } = CLUSTER_DEFAULTS,
) => {
  const semantic = Math.min(
    1,
    Math.max(0, dotProduct(report.embedding, cluster.embedding)),
  );
  const distance = distanceMeters(report.point, cluster.point);
  return combineScores(semantic, spatialScore(distance, radiusM), alpha);
};

// True when every member lies within radiusM of the centroid. Joining is
// refused when the moved centroid would break this, so the invariant holds.
export const fitsRadius = (members, centroidPoint, radiusM) =>
  members.every(
    (member) =>
      member.point && distanceMeters(member.point, centroidPoint) <= radiusM,
  );

// Chooses the cluster a report should join, or null to open a new one. Shared
// by the service and the evaluation script so both behave the same.
// member: { point, embedding }; clusters: [{ point, embedding, members }] of the
// right type. A cluster qualifies when its centroid is within radiusM, the
// score reaches tau, and the moved centroid keeps all members within radiusM.
// Returns { cluster, members, centroid } for the best qualifying cluster.
export const pickCluster = (member, clusters, params = CLUSTER_DEFAULTS) => {
  const { alpha, radiusM, tau } = { ...CLUSTER_DEFAULTS, ...params };

  const ranked = clusters
    .filter((cluster) => distanceMeters(member.point, cluster.point) <= radiusM)
    .map((cluster) => ({
      cluster,
      score: scoreAgainstCluster(member, cluster, { alpha, radiusM }),
    }))
    .filter((item) => item.score >= tau)
    .sort((a, b) => b.score - a.score);

  for (const { cluster } of ranked) {
    const members = [...cluster.members, member];
    const centroid = computeCentroid(members);
    if (fitsRadius(members, centroid.point, radiusM)) {
      return { cluster, members, centroid };
    }
  }
  return null;
};

// active while any report is unresolved; resolved when every report is closed
// and at least one was resolved; closed when all were rejected.
export const deriveClusterStatus = (statuses) => {
  if (statuses.some((status) => ACTIVE_STATUSES.includes(status))) {
    return "active";
  }
  return statuses.includes("resolved") ? "resolved" : "closed";
};

// Most frequent value; the first one seen wins a tie.
export const dominantValue = (values) => {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = null;
  for (const [value, count] of counts) {
    if (best === null || count > counts.get(best)) best = value;
  }
  return best;
};
