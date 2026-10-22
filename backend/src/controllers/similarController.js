import Report from "../models/Report.js";
import { embedText } from "../services/embeddingService.js";
import { findSimilarReports } from "../services/similarityService.js";
import { geoToLatLng, isWithinLviv } from "../utils/geo.js";
import { parseSimilarityParams } from "../utils/similarityParams.js";

// GET /api/reports/:id/related?strategy=vector|geo&alpha=&radius=&limit=
export const getRelatedReports = async (req, res) => {
  try {
    const { params, error } = parseSimilarityParams(req.query);
    if (error) return res.status(400).json({ message: error });

    const report = await Report.findById(req.params.id).select("+embedding");
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Reports saved while Gemini was down have no vector until backfill.
    if (!report.embedding?.length) {
      return res.json({ items: [], note: "Report has no embedding yet" });
    }

    const point = geoToLatLng(report.geo);
    if (params.strategy === "geo" && !point) {
      return res
        .status(400)
        .json({ message: "Report has no coordinates for geo search" });
    }

    const items = await findSimilarReports({
      ...params,
      embedding: report.embedding,
      point,
      excludeId: report._id,
    });

    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/reports/search?q=text&lat=&lng=&strategy=&alpha=&radius=&limit=
// Without lat/lng the ranking uses meaning only.
export const searchReports = async (req, res) => {
  try {
    const text = String(req.query.q ?? "").trim();
    if (text.length < 3) {
      return res
        .status(400)
        .json({ message: "q must contain at least 3 characters" });
    }

    const { params, error } = parseSimilarityParams(req.query);
    if (error) return res.status(400).json({ message: error });

    let point = null;
    if (req.query.lat !== undefined || req.query.lng !== undefined) {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      if (!isWithinLviv(lat, lng)) {
        return res
          .status(400)
          .json({ message: "lat and lng must be a point inside Lviv" });
      }
      point = { lat, lng };
    }
    if (params.strategy === "geo" && !point) {
      return res
        .status(400)
        .json({ message: "geo strategy needs lat and lng" });
    }

    let embedding;
    try {
      embedding = await embedText(text, "query");
    } catch (embeddingError) {
      console.error("Embedding error:", embeddingError.message);
      return res
        .status(503)
        .json({ message: "Search is temporarily unavailable" });
    }

    const items = await findSimilarReports({ ...params, embedding, point });
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
