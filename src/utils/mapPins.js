import L from "leaflet";

// Round-headed pin as an inline SVG icon: black for the original report, blue
// for the people who support it. `scale` shrinks the pin (e.g. 0.8).
export const pinIcon = (color, scale = 1) =>
  L.divIcon({
    className: "sup-pin",
    iconSize: [26 * scale, 36 * scale],
    iconAnchor: [13 * scale, 36 * scale],
    html: `<svg width="${26 * scale}" height="${36 * scale}" viewBox="0 0 26 36" aria-hidden="true"><path d="M13 0C6 0 1 5.5 1 12c0 9 12 23 12 23s12-14 12-23C25 5.5 20 0 13 0z" fill="${color}"/><circle cx="13" cy="12" r="4.5" fill="#fff"/></svg>`,
  });

export const PIN_BLACK = "#000";
export const PIN_BLUE = "#2563eb";
