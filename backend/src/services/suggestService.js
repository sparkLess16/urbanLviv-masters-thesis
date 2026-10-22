import Report from "../models/Report.js";
import { embedText } from "./embeddingService.js";
import { createCachedEmbedder } from "./queryEmbeddingCache.js";
import { findGeoFirst, hasNearbyReports } from "./similarityService.js";
import { SUGGEST_SETTINGS } from "../config/duplicateThresholds.js";
import { geoToLatLng } from "../utils/geo.js";

// Role "document", not "query": the typed text is compared with stored reports
// (also documents), and the thresholds were tuned on document-to-document
// pairs. The "query" role gives noticeably lower scores for the same pairs.
const embedForHints = createCachedEmbedder((text) =>
  embedText(text, "document"),
);

// Same text as the stored embedding of a report, built from what is typed so far.
export const buildSuggestText = ({ title = "", description = "" }) => {
  const parts = [title.trim(), description.trim()].filter(Boolean);
  return parts.join(". ");
};

export const makeSnippet = (
  text = "",
  length = SUGGEST_SETTINGS.snippetLength,
) => (text.length <= length ? text : `${text.slice(0, length).trimEnd()}…`);

// Shapes one ranked result for the client. `details` comes from the report.
export const toSuggestion = (item, details, settings = SUGGEST_SETTINGS) => ({
  reportId: item.reportId,
  title: item.title,
  description: makeSnippet(details?.description, settings.snippetLength),
  type_id: item.type_id,
  created_dt: details?.created_dt ?? null,
  // Where the report is: the support dialog shows it on a small map.
  point: geoToLatLng(details?.geo),
  distance_m: item.distance_m,
  // What the person sees as "N% match": similarity of the texts.
  score: item.semantic_score,
  match_percent: Math.round(item.semantic_score * 100),
  // The client shows the "same problem?" dialog only for strong matches.
  strong_match:
    item.semantic_score >= settings.dialogMinSemantic &&
    item.distance_m !== null &&
    item.distance_m <= settings.dialogRadiusM,
});

const loadDetails = async (ids) => {
  const reports = await Report.find({ _id: { $in: ids } })
    .select("description created_dt geo")
    .lean();
  return new Map(reports.map((report) => [String(report._id), report]));
};

const DEFAULT_DEPS = {
  embed: embedForHints,
  hasNearby: hasNearbyReports,
  findSimilar: findGeoFirst,
  loadDetails,
};

// Hints for the report form. Returns { items, reason? }; never throws for
// Gemini problems: no hints is a valid answer and the form keeps working.
// Order of cost: text length check, free geo pre-check, only then Gemini.
export const suggestSimilar = async (
  { title, description, point, userId },
  settings = SUGGEST_SETTINGS,
  deps = DEFAULT_DEPS,
) => {
  const text = buildSuggestText({ title, description });
  if (text.length < settings.minTextLength) {
    return { items: [], reason: "too_short" };
  }
  if (!point) return { items: [], reason: "no_location" };

  const nearby = await deps.hasNearby({
    point,
    radiusM: settings.radiusM,
    excludeUserId: userId,
    excludeStatuses: ["cancelled", "resolved"],
  });
  if (!nearby) return { items: [], reason: "nothing_nearby" };

  let embedding;
  try {
    embedding = await deps.embed(text);
  } catch (error) {
    console.error("Suggest embedding error:", error.message);
    return { items: [], reason: "unavailable" };
  }

  const ranked = await deps.findSimilar({
    embedding,
    point,
    radiusM: settings.radiusM,
    limit: settings.limit,
    minSemantic: settings.hintMinSemantic,
    excludeUserId: userId,
    excludeStatuses: ["cancelled", "resolved"],
  });
  if (ranked.length === 0) return { items: [] };

  const details = await deps.loadDetails(ranked.map((item) => item.reportId));
  return {
    items: ranked.map((item) =>
      toSuggestion(item, details.get(String(item.reportId)), settings),
    ),
  };
};
