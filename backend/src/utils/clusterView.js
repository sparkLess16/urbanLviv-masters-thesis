import { geoToLatLng } from "./geo.js";

// Cluster as the list and the map need it: the name comes from the
// representative report, the centroid is flattened to { lat, lng }.
export const toClusterItem = (cluster, { title, inProgressCount = 0 }) => ({
  id: cluster._id,
  title: title ?? null,
  type_id: cluster.type_id,
  district_id: cluster.district_id,
  status: cluster.status,
  reports_count: cluster.reports_count,
  in_progress_count: inProgressCount,
  responsible_service: cluster.responsible_service,
  centroid: {
    lat: cluster.centroid.coordinates[1],
    lng: cluster.centroid.coordinates[0],
  },
});

// A member report on the map: only what the popup shows.
export const toClusterReport = (report) => ({
  id: report._id,
  title: report.title,
  status_id: report.status_id,
  type_id: report.type_id,
  created_dt: report.created_dt,
  point: geoToLatLng(report.geo),
});
