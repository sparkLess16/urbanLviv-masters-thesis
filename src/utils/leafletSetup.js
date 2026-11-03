import L from "leaflet";
import { LVIV_BOUNDS } from "./geo";

// Options shared by every map: Lviv-only view and OpenStreetMap tiles.
export const lvivMaxBounds = () => [
  [LVIV_BOUNDS.minLat - 0.05, LVIV_BOUNDS.minLng - 0.05],
  [LVIV_BOUNDS.maxLat + 0.05, LVIV_BOUNDS.maxLng + 0.05],
];

export const MIN_ZOOM = 11;

export const addOsmTiles = (map) =>
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);
