import mongoose from "mongoose";
import Report from "../models/Report.js";
import {
  atlasScoreToCosine,
  combineScores,
  distanceMeters,
  dotProduct,
  spatialScore,
} from "../utils/geoMath.js";
import { geoToLatLng } from "../utils/geo.js";

export const VECTOR_INDEX_NAME = "reports_embedding_index";

// Starting values; tuned on the evaluation set in step EV.
export const DEFAULTS = { alpha: 0.7, radiusM: 500, limit: 5 };

const DEFAULT_EXCLUDED_STATUSES = ["cancelled"];
const EARTH_RADIUS_M = 6378100;

const GEO_CANDIDATES = 200;
const VECTOR_CANDIDATES = 100;
const VECTOR_NUM_CANDIDATES = 200;

const PUBLIC_FIELDS = {
  title: 1,
  type_id: 1,
  district_id: 1,
  status_id: 1,
  geo: 1,
};

const round = (value, digits = 4) => Number(value.toFixed(digits));

// Scores candidates and returns them best first. Pure function, no database.
// candidate: { _id, title, type_id, district_id, status_id, geo, semantic }
//   where semantic is a cosine similarity in 0..1.
// point: { lat, lng } of the query, or null when the query has no location;
//   then only the semantic part is used.
export const rankCandidates = (
  candidates,
  { point = null, alpha, radiusM, limit, minScore = 0, minSemantic = 0 },
) => {
  const effectiveAlpha = point ? alpha : 1;

  return candidates
    .map((candidate) => {
      const location = geoToLatLng(candidate.geo);
      const distance =
        point && location ? distanceMeters(point, location) : null;
      const spatial = spatialScore(distance, radiusM);
      const score = combineScores(candidate.semantic, spatial, effectiveAlpha);

      return {
        reportId: candidate._id,
        title: candidate.title,
        type_id: candidate.type_id,
        district_id: candidate.district_id,
        status_id: candidate.status_id,
        distance_m: distance === null ? null : Math.round(distance),
        score: round(score),
        semantic_score: round(candidate.semantic),
        spatial_score: round(spatial),
      };
    })
    .filter(
      (item) => item.score >= minScore && item.semantic_score >= minSemantic,
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

const toObjectId = (id) => (id ? new mongoose.Types.ObjectId(id) : null);

// Strategy 1 (geo-first): take every report within radiusM of the point using
// the 2dsphere index, then compare vectors in Node. Exact in space, but does
// not use the vector index. Needs a query point.
export const findGeoFirst = async ({
  embedding,
  point,
  excludeId,
  excludeUserId,
  excludeStatuses = DEFAULT_EXCLUDED_STATUSES,
  alpha = DEFAULTS.alpha,
  radiusM = DEFAULTS.radiusM,
  limit = DEFAULTS.limit,
  minScore = 0,
  minSemantic = 0,
}) => {
  if (!point) throw new Error("geo-first search needs a query point");

  const query = {
    status_id: { $nin: excludeStatuses },
    embedding: { $exists: true },
  };
  if (excludeId) query._id = { $ne: toObjectId(excludeId) };
  if (excludeUserId) query.created_by = { $ne: toObjectId(excludeUserId) };

  const nearby = await Report.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: [point.lng, point.lat] },
        distanceField: "distance_m",
        maxDistance: radiusM,
        spherical: true,
        key: "geo",
        query,
      },
    },
    { $limit: GEO_CANDIDATES },
    { $project: { ...PUBLIC_FIELDS, embedding: 1 } },
  ]);

  const candidates = nearby.map((report) => ({
    ...report,
    // Vectors are normalized, so the dot product is the cosine similarity.
    semantic: Math.min(1, Math.max(0, dotProduct(embedding, report.embedding))),
  }));

  return rankCandidates(candidates, {
    point,
    alpha,
    radiusM,
    limit,
    minScore,
    minSemantic,
  });
};

// Free pre-check (no Gemini): is there any report within radiusM of the point?
// Used to skip the paid embedding call when nothing could be similar.
export const hasNearbyReports = async ({
  point,
  radiusM = DEFAULTS.radiusM,
  excludeUserId,
  excludeStatuses = DEFAULT_EXCLUDED_STATUSES,
}) => {
  const query = {
    geo: {
      $geoWithin: {
        $centerSphere: [[point.lng, point.lat], radiusM / EARTH_RADIUS_M],
      },
    },
    status_id: { $nin: excludeStatuses },
    embedding: { $exists: true },
  };
  if (excludeUserId) query.created_by = { $ne: toObjectId(excludeUserId) };
  return Boolean(await Report.exists(query));
};

// Strategy 2 (vector-first, required by NFR-04): take the closest reports by
// meaning from Atlas Vector Search, then add the distance in Node. Risk: all
// top semantic candidates may be far away.
export const findVectorFirst = async ({
  embedding,
  point = null,
  excludeId,
  alpha = DEFAULTS.alpha,
  radiusM = DEFAULTS.radiusM,
  limit = DEFAULTS.limit,
  minScore = 0,
  minSemantic = 0,
}) => {
  const found = await Report.aggregate([
    {
      $vectorSearch: {
        index: VECTOR_INDEX_NAME,
        path: "embedding",
        queryVector: embedding,
        numCandidates: VECTOR_NUM_CANDIDATES,
        limit: VECTOR_CANDIDATES,
        filter: { status_id: { $ne: "cancelled" } },
      },
    },
    {
      $project: {
        ...PUBLIC_FIELDS,
        atlas_score: { $meta: "vectorSearchScore" },
      },
    },
  ]);

  const candidates = found
    .filter((report) => !excludeId || String(report._id) !== String(excludeId))
    .map((report) => ({
      ...report,
      semantic: atlasScoreToCosine(report.atlas_score),
    }));

  return rankCandidates(candidates, {
    point,
    alpha,
    radiusM,
    limit,
    minScore,
    minSemantic,
  });
};

export const STRATEGIES = {
  geo: findGeoFirst,
  vector: findVectorFirst,
};

export const findSimilarReports = ({ strategy = "vector", ...params }) => {
  const find = STRATEGIES[strategy];
  if (!find) throw new Error(`Unknown strategy: ${strategy}`);
  return find(params);
};
