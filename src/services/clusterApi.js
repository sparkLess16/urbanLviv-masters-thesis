import api from "./api";

// status: open | resolved | closed | all; district_id: an id or "all"
export const fetchClusters = ({ district_id = "all", status = "open" } = {}) =>
  api
    .get("/api/clusters", { params: { district_id, status } })
    .then((res) => res.data.items);

export const fetchCluster = (id) =>
  api.get(`/api/clusters/${id}`).then((res) => res.data);

export const fetchDistrictBorders = () =>
  api.get("/api/geo/districts").then((res) => res.data);

export const fetchDistricts = () =>
  api.get("/api/reports/districts").then((res) => res.data);

export const fetchTypes = () =>
  api.get("/api/reports/types").then((res) => res.data);
