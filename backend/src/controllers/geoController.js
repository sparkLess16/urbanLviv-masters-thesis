import { buildGeoPoint, geoToLatLng } from "../utils/geo.js";
import { findDistrictId } from "../utils/districtLookup.js";
import { geocodingService } from "../services/geocodingService.js";

const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 200;

// GET /api/geo/reverse?lat&lng -> { display, district_id }
// `display` is only a suggestion for the "location" field (may be null).
export const reverseGeocode = async (req, res) => {
  const { geo, error } = buildGeoPoint(req.query.lat, req.query.lng);
  if (error) return res.status(400).json({ message: error });

  const { lat, lng } = geoToLatLng(geo);
  const display = await geocodingService.reverseGeocode(lat, lng);

  res.json({ display, district_id: findDistrictId(lat, lng) });
};

// GET /api/geo/forward?q=<address> -> { found, lat, lng, district_id }
// Looks the typed address up inside Lviv; found=false if there is no match.
export const forwardGeocode = async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (query.length < MIN_QUERY_LENGTH || query.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({
      message: `Address must be ${MIN_QUERY_LENGTH}-${MAX_QUERY_LENGTH} characters`,
    });
  }

  const point = await geocodingService.forwardGeocode(query);
  // A point outside every district polygon is a false match on the outskirts.
  const districtId = point && findDistrictId(point.lat, point.lng);
  if (!districtId) return res.json({ found: false });

  res.json({
    found: true,
    lat: point.lat,
    lng: point.lng,
    district_id: districtId,
  });
};
