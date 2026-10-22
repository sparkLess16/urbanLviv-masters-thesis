import { buildGeoPoint, geoToLatLng } from "../utils/geo.js";
import { suggestSimilar } from "../services/suggestService.js";

// POST /api/reports/suggest { title, description, lat, lng }
// POST rather than GET: the text can be long and must not end up in URLs/logs.
export const suggestReports = async (req, res) => {
  try {
    const { title, description, lat, lng } = req.body ?? {};
    if (
      (title !== undefined && typeof title !== "string") ||
      (description !== undefined && typeof description !== "string")
    ) {
      return res
        .status(400)
        .json({ message: "title and description must be strings" });
    }

    let point = null;
    if (lat !== undefined || lng !== undefined) {
      const { geo, error } = buildGeoPoint(lat, lng);
      if (error) return res.status(400).json({ message: error });
      point = geoToLatLng(geo);
    }

    const result = await suggestSimilar({
      title,
      description,
      point,
      userId: req.user._id,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
