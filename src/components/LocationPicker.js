import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { LVIV_BOUNDS, LVIV_CENTER, isWithinLviv } from "../utils/geo";
import { PIN_BLACK, PIN_BLUE, pinIcon } from "../utils/mapPins";
import "../styles/LocationPicker.css";

// Webpack (CRA) cannot resolve Leaflet's default marker icon paths.
const markerImage = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// `compact` shortens the map and puts the hint on it; `overlay` is a control
// shown in the map's top-right corner; `notice` is a warning from outside;
// `extraPoints` (even an empty array) turns the pin black and shows the
// supporters' points as small blue pins with a legend.
const LocationPicker = ({
  value,
  onChange,
  readOnly = false,
  compact = false,
  overlay = null,
  notice = null,
  extraPoints,
}) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const lastValidRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [hint, setHint] = useState(null);

  onChangeRef.current = onChange;

  const placeMarker = (lat, lng) => {
    lastValidRef.current = [lat, lng];
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      return;
    }
    const marker = L.marker([lat, lng], {
      icon: extraPoints === undefined ? markerImage : pinIcon(PIN_BLACK),
      draggable: !readOnly,
    }).addTo(mapRef.current);

    if (!readOnly) {
      marker.on("dragend", () => {
        const { lat: newLat, lng: newLng } = marker.getLatLng();
        if (isWithinLviv(newLat, newLng)) {
          setHint(null);
          lastValidRef.current = [newLat, newLng];
          onChangeRef.current({ lat: newLat, lng: newLng });
        } else {
          setHint("Please select a point within Lviv");
          marker.setLatLng(lastValidRef.current);
        }
      });
    }
    markerRef.current = marker;
  };

  useEffect(() => {
    const map = L.map(containerRef.current, {
      center: value
        ? [value.lat, value.lng]
        : [LVIV_CENTER.lat, LVIV_CENTER.lng],
      zoom: value ? 16 : 12,
      maxBounds: [
        [LVIV_BOUNDS.minLat - 0.05, LVIV_BOUNDS.minLng - 0.05],
        [LVIV_BOUNDS.maxLat + 0.05, LVIV_BOUNDS.maxLng + 0.05],
      ],
      minZoom: 11,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    if (value) placeMarker(value.lat, value.lng);

    if (!readOnly) {
      map.on("click", (event) => {
        const { lat, lng } = event.latlng;
        if (!isWithinLviv(lat, lng)) {
          setHint("Please select a point within Lviv");
          return;
        }
        setHint(null);
        placeMarker(lat, lng);
        onChangeRef.current({ lat, lng });
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // The map is created once; later value changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync marker when the value changes from outside (e.g. form reset).
  useEffect(() => {
    if (!mapRef.current) return;
    if (value) {
      placeMarker(value.lat, value.lng);
      // The point may come from the "My location" button, off the visible area.
      if (!mapRef.current.getBounds().contains([value.lat, value.lng])) {
        mapRef.current.setView([value.lat, value.lng], 16);
      }
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  // Supporters' points. The key keeps the effect from running on every render.
  const extraKey = (extraPoints ?? [])
    .map((point) => `${point.lat},${point.lng}`)
    .join("|");
  useEffect(() => {
    if (!mapRef.current || extraPoints === undefined) return undefined;

    const group = L.layerGroup(
      extraPoints.map((point) =>
        L.marker([point.lat, point.lng], {
          icon: pinIcon(PIN_BLUE, 0.8),
          interactive: false,
        }),
      ),
    ).addTo(mapRef.current);

    if (value && extraPoints.length > 0) {
      const bounds = L.latLngBounds([
        [value.lat, value.lng],
        ...extraPoints.map((point) => [point.lat, point.lng]),
      ]);
      mapRef.current.fitBounds(bounds.pad(0.3), { maxZoom: 16 });
    }
    return () => group.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraKey, value?.lat, value?.lng]);

  // The picker's own warning wins over the external notice, then the default.
  const message =
    hint || notice || "Click the map or drag the pin to mark the place";

  return (
    <div className={`location-picker${compact ? " compact" : ""}`}>
      <div ref={containerRef} className="location-picker-map" />
      {overlay && <div className="location-picker-overlay">{overlay}</div>}
      {extraPoints !== undefined && (
        <div className="location-picker-legend">
          <span>
            <i style={{ background: PIN_BLACK }} />
            Original report
          </span>
          <span>
            <i style={{ background: PIN_BLUE }} />
            Supporters
          </span>
        </div>
      )}
      {!readOnly && (
        <p
          className={`location-picker-hint${hint || notice ? " is-warning" : ""}`}
        >
          {message}
        </p>
      )}
    </div>
  );
};

export default LocationPicker;
