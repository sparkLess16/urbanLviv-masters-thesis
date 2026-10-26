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
// An optional params.judge(member, cluster) may return true or false for a
// borderline case; that verdict then replaces the tau test for that cluster.
// Returns { cluster, members, centroid } for the best qualifying cluster.
export const pickCluster = (member, clusters, params = CLUSTER_DEFAULTS) => {
  const { alpha, radiusM, tau, judge } = { ...CLUSTER_DEFAULTS, ...params };

  const ranked = clusters
    .filter((cluster) => distanceMeters(member.point, cluster.point) <= radiusM)
    .map((cluster) => ({
      cluster,
      score: scoreAgainstCluster(member, cluster, { alpha, radiusM }),
      // true/false when the judge decided this borderline case, else null.
      verdict: judge ? (judge(member, cluster) ?? null) : null,
    }))
    .filter((item) =>
      item.verdict === null ? item.score >= tau : item.verdict,
    )
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

// Members of a candidate cluster that the judge should compare with a new
// report. Empty when the closest member is outside the grey zone [low, high):
// then the score decides. Otherwise the k closest members that are in the zone.
export const judgePairsFor = (member, cluster, { low, high, k }) => {
  const nearest = cluster.members
    .filter((other) => other.embedding)
    .map((other) => ({
      other,
      cosine: dotProduct(member.embedding, other.embedding),
    }))
    .sort((x, y) => y.cosine - x.cosine);

  if (!nearest.length) return [];
  if (nearest[0].cosine < low || nearest[0].cosine >= high) return [];
  return nearest
    .slice(0, k)
    .filter((item) => item.cosine >= low && item.cosine < high)
    .map((item) => item.other);
};

// One verdict from several judged pairs: "any" needs a single yes,
// "majority" needs more yes than no. No answers means no opinion (null).
export const combineVerdicts = (verdicts, vote) => {
  if (!verdicts.length) return null;
  const yes = verdicts.filter(Boolean).length;
  return vote === "any" ? yes > 0 : yes * 2 > verdicts.length;
};
