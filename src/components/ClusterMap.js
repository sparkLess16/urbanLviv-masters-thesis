import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  LVIV_CENTER,
  distanceMeters,
  fanOutOverlapping,
  findDistrictAt,
} from "../utils/geo";
import { MIN_ZOOM, addOsmTiles, lvivMaxBounds } from "../utils/leafletSetup";
import { REPORT_STATUS_LABELS, markerSize } from "../utils/clusterLabels";
import { formatDate } from "../utils/formatDate";
import "../styles/ClusterExplorer.css";

// A white casing under a dark dashed line keeps the border readable on the
// busy OpenStreetMap tiles without taking over the map.
const BORDER_CASING = {
  color: "#fff",
  weight: 6,
  opacity: 0.85,
  fillOpacity: 0,
  interactive: false,
};
const BORDER_LINE = {
  color: "#0b5a52",
  weight: 2.5,
  dashArray: "9 7",
  fillColor: "#0f766e",
  fillOpacity: 0.05,
  interactive: false,
};

const toLatLng = (point) => [point.lat, point.lng];

// Above this zoom the district labels are replaced by the "current district".
const LABEL_ZOOM_MAX = 13;

const clusterIcon = (cluster) => {
  const size = markerSize(cluster.reports_count);
  return L.divIcon({
    className: "cx-marker-wrap",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="cx-marker cx-marker--${cluster.status}" style="width:${size}px;height:${size}px;font-size:${Math.round(size / 2.2)}px">${cluster.reports_count}</div>`,
  });
};

const dotIcon = (statusId) =>
  L.divIcon({
    className: "cx-marker-wrap",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<div class="cx-dot cx-dot--${statusId}"></div>`,
  });

// The popup is built from DOM nodes, so report titles are never read as HTML.
const reportPopup = (report, onOpen) => {
  const root = document.createElement("div");
  root.className = "cx-popup";

  const title = document.createElement("strong");
  title.textContent = report.title;

  const pill = document.createElement("span");
  pill.className = `cx-pill cx-pill--${report.status_id}`;
  pill.textContent = REPORT_STATUS_LABELS[report.status_id] ?? report.status_id;

  const meta = document.createElement("p");
  meta.textContent = `Reported ${formatDate(report.created_dt)}`;

  const link = document.createElement("a");
  link.href = `/userAccount/${report.id}`;
  link.textContent = "Open report →";
  link.addEventListener("click", (event) => {
    event.preventDefault();
    onOpen(report.id);
  });

  root.append(title, pill, meta, link);
  return root;
};

// Cluster markers with the report count (FR-08). With `detail` the map zooms
// to that cluster and shows its member reports as separate points.
// `leftInset` keeps the cluster clear of the floating list on wide screens.
const ClusterMap = ({
  clusters,
  detail,
  borders,
  districtNames,
  onSelectCluster,
  onOpenReport,
  onViewDistrict,
}) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const clusterLayerRef = useRef(null);
  const detailLayerRef = useRef(null);
  const reportRef = useRef(null);
  const borderLayerRef = useRef(null);
  const callbacksRef = useRef({});
  callbacksRef.current = { onSelectCluster, onOpenReport, onViewDistrict };
  const bordersRef = useRef(borders);
  bordersRef.current = borders;

  const fitPadding = () => {
    const wide = containerRef.current.clientWidth > 900;
    return {
      paddingTopLeft: [wide ? 440 : 40, 70],
      paddingBottomRight: [40, 70],
    };
  };

  useEffect(() => {
    const map = L.map(containerRef.current, {
      center: [LVIV_CENTER.lat, LVIV_CENTER.lng],
      zoom: 12,
      maxBounds: lvivMaxBounds(0.2),
      minZoom: MIN_ZOOM,
      zoomControl: false,
    });
    // On the right: the list covers the left side.
    L.control.zoom({ position: "topright" }).addTo(map);
    addOsmTiles(map);
    borderLayerRef.current = L.layerGroup().addTo(map);
    clusterLayerRef.current = L.layerGroup().addTo(map);
    detailLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Close up the district labels are off screen, so the name of the district
    // under the map centre is reported instead (shown by the parent).
    const reportViewDistrict = () => {
      const features = bordersRef.current?.features;
      const close = map.getZoom() > LABEL_ZOOM_MAX;
      const { lat, lng } = map.getCenter();
      callbacksRef.current.onViewDistrict?.(
        close && features ? findDistrictAt({ lat, lng }, features) : null,
      );
    };
    map.on("moveend", reportViewDistrict);
    reportRef.current = reportViewDistrict;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // District borders, labelled only while the whole city is in view.
  useEffect(() => {
    const layer = borderLayerRef.current;
    layer.clearLayers();
    if (!borders) return;
    L.geoJSON(borders, { style: () => BORDER_CASING }).addTo(layer);
    L.geoJSON(borders, {
      style: () => BORDER_LINE,
      onEachFeature: (feature, polygon) => {
        const name = districtNames[feature.properties.district_id];
        if (name && !detail) {
          polygon.bindTooltip(name, {
            permanent: true,
            direction: "center",
            className: "cx-district-label",
          });
        }
      },
    }).addTo(layer);
    reportRef.current?.();
  }, [borders, districtNames, detail]);

  // One marker per cluster; the selected one is replaced by its reports.
  useEffect(() => {
    const layer = clusterLayerRef.current;
    layer.clearLayers();
    clusters.forEach((cluster) => {
      if (detail && cluster.id === detail.id) return;
      L.marker(toLatLng(cluster.centroid), {
        icon: clusterIcon(cluster),
        opacity: detail ? 0.45 : 1,
        keyboard: true,
        title: `${cluster.title ?? "Cluster"}: ${cluster.reports_count}`,
      })
        .on("click", () => callbacksRef.current.onSelectCluster(cluster.id))
        .addTo(layer);
    });

    if (!detail && clusters.length) {
      const bounds = L.latLngBounds(clusters.map((c) => toLatLng(c.centroid)));
      mapRef.current.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 15,
      });
    }
  }, [clusters, detail]);

  // Member reports of the selected cluster, zoomed in on them.
  useEffect(() => {
    const layer = detailLayerRef.current;
    const map = mapRef.current;
    layer.clearLayers();
    map.closePopup();
    if (!detail) return;

    const shown = fanOutOverlapping(detail.reports, (report) => report.point);
    const points = detail.reports.map((report) => toLatLng(shown.get(report)));
    const radius =
      Math.max(
        0,
        ...detail.reports.map((report) =>
          distanceMeters(detail.centroid, report.point),
        ),
      ) + 40;
    L.circle(toLatLng(detail.centroid), {
      radius,
      color: "#0f766e",
      weight: 2,
      dashArray: "3 6",
      fillOpacity: 0.1,
      interactive: false,
    }).addTo(layer);

    detail.reports.forEach((report) => {
      L.marker(toLatLng(shown.get(report)), {
        icon: dotIcon(report.status_id),
        title: report.title,
      })
        .bindPopup(
          reportPopup(report, (id) => callbacksRef.current.onOpenReport(id)),
          { closeButton: true, minWidth: 220 },
        )
        .addTo(layer);
    });

    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { ...fitPadding(), maxZoom: 17 });
    } else {
      map.setView(points[0] ?? toLatLng(detail.centroid), 17);
    }
    // fitPadding only reads the container width.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  return (
    <div
      ref={containerRef}
      className="cx-map"
      role="region"
      aria-label="Map of problem clusters"
    />
  );
};

export default ClusterMap;
