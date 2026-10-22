import api from './api';

// Reports similar to the given one, best first. Each item has
// { reportId, title, type_id, district_id, status_id, distance_m, score, ... }.
export const fetchRelatedReports = async (reportId, { limit = 5 } = {}) => {
  const { data } = await api.get(`/api/reports/${reportId}/related`, {
    params: { limit },
  });
  return data.items;
};

// Search by meaning. Pass { lat, lng } to also rank by distance.
export const searchReports = async (text, { lat, lng, limit = 5 } = {}) => {
  const { data } = await api.get('/api/reports/search', {
    params: { q: text, lat, lng, limit },
  });
  return data.items;
};
