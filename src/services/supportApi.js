import api from "./api";

// Hints for the report form. `signal` cancels a request that became outdated.
export const suggestReports = async (payload, signal) => {
  const { data } = await api.post("/api/reports/suggest", payload, { signal });
  return data;
};

// payload: { comment?, lat?, lng?, via?, score? }
export const supportReport = async (reportId, payload) => {
  const { data } = await api.post(`/api/reports/${reportId}/support`, payload);
  return data;
};

export const stopSupportingReport = async (reportId) => {
  const { data } = await api.delete(`/api/reports/${reportId}/support`);
  return data;
};

// Replaces the comment and the marked point of one's own support.
// payload: { comment?, lat?, lng? } (no lat/lng removes the point)
export const updateSupport = async (reportId, payload) => {
  const { data } = await api.put(`/api/reports/${reportId}/support`, payload);
  return data;
};
