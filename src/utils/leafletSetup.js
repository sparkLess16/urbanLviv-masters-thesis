import L from "leaflet";
import { LVIV_BOUNDS } from "./geo";

// Options shared by every map: Lviv-only view and OpenStreetMap tiles.
// `margin` (degrees) is how far the view may leave the city box; a map with
// a panel over its edge needs more room to bring edge places into view.
export const lvivMaxBounds = (margin = 0.05) => [
  [LVIV_BOUNDS.minLat - margin, LVIV_BOUNDS.minLng - margin],
  [LVIV_BOUNDS.maxLat + margin, LVIV_BOUNDS.maxLng + margin],
];

export const MIN_ZOOM = 11;

export const addOsmTiles = (map) =>
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);
