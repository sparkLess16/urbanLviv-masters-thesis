import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { distanceMeters, isWithinLviv } from "../utils/geo";
import { PIN_BLACK, PIN_BLUE, pinIcon } from "../utils/mapPins";
import "../styles/Support.css";

export const MAX_SUPPORT_DISTANCE_M = 1000;

// Mini map of the support dialog: the report (black pin, fixed) and the place
// where the person saw the problem (blue pin, draggable within 1 km).
const SupportPointMap = ({ origin, value, onChange }) => {
  const containerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [distance, setDistance] = useState(
    Math.round(distanceMeters(origin, value ?? origin)),
  );
  const [warning, setWarning] = useState(false);

  onChangeRef.current = onChange;

  useEffect(() => {
    const map = L.map(containerRef.current, { zoomControl: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    const originLatLng = [origin.lat, origin.lng];
    const start = value ?? origin;
    // Show both pins with some margin. The view must be set before layers that
    // need it, and the bounds are computed without the map (circle.getBounds()
    // would need one).
    map.fitBounds(
      L.latLng(originLatLng)
        .toBounds(400)
        .extend(L.latLng(start.lat, start.lng))
        .pad(0.3),
      { maxZoom: 17 },
    );
    L.circle(originLatLng, {
      radius: MAX_SUPPORT_DISTANCE_M,
      color: "#6b7280",
      weight: 1,
      dashArray: "4 4",
      fillOpacity: 0.05,
    }).addTo(map);

    L.marker(originLatLng, {
      icon: pinIcon(PIN_BLACK),
      interactive: false,
    }).addTo(map);

    let lastValid = [start.lat, start.lng];
    const marker = L.marker(lastValid, {
      icon: pinIcon(PIN_BLUE),
      draggable: true,
    }).addTo(map);

    marker.on("dragend", () => {
      const { lat, lng } = marker.getLatLng();
      const meters = distanceMeters(origin, { lat, lng });
      if (meters > MAX_SUPPORT_DISTANCE_M || !isWithinLviv(lat, lng)) {
        marker.setLatLng(lastValid);
        setWarning(true);
        return;
      }
      setWarning(false);
      lastValid = [lat, lng];
      setDistance(Math.round(meters));
      onChangeRef.current({ lat, lng });
    });

    return () => map.remove();
    // The map is built once for the dialog's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="sup-map">
      <div ref={containerRef} className="sup-map-canvas" />
      <div className={`sup-map-hint${warning ? " is-warning" : ""}`}>
        {warning
          ? "Too far from the report (max 1 km)"
          : `Drag the blue pin. ${distance} m from the report (max 1 km).`}
      </div>
    </div>
  );
};

export default SupportPointMap;
