import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { fetchRelatedReports } from '../services/similarApi';
import '../styles/SimilarReports.css';

const capitalize = (text) =>
  text ? text.charAt(0).toUpperCase() + text.slice(1).replace(/_/g, ' ') : '';

const formatDistance = (meters) => {
  if (meters === null || meters === undefined) return 'location unknown';
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
};

const SimilarReports = ({ reportId }) => {
  const [items, setItems] = useState(null);
  const [statuses, setStatuses] = useState({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchRelatedReports(reportId),
      // Same names and colors as the status pills elsewhere in the app.
      api.get('/api/reports/statuses').then((res) => res.data),
    ])
      .then(([related, statusList]) => {
        if (cancelled) return;
        setStatuses(Object.fromEntries(statusList.map((s) => [s.id, s])));
        setItems(related);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [reportId]);

  return (
    <div className="similar-reports">
      <h3 className="similar-title">Similar reports</h3>

      {failed && (
        <p className="similar-empty">Similar reports are unavailable now.</p>
      )}
      {!failed && items === null && <p className="similar-empty">Loading...</p>}
      {items && items.length === 0 && (
        <p className="similar-empty">No similar reports found.</p>
      )}

      {items &&
        items.map((item) => {
          const status = statuses[item.status_id];

          return (
            <Link
              key={item.reportId}
              to={`/userAccount/${item.reportId}`}
              className="similar-item"
            >
              <span className="similar-item-title">{item.title}</span>
              <span className="similar-item-meta">
                {capitalize(item.type_id)} · {capitalize(item.district_id)} ·{' '}
                {formatDistance(item.distance_m)}
              </span>
              <span className="similar-item-side">
                <span
                  className="similar-status"
                  style={{ backgroundColor: status?.color }}
                >
                  {status?.name ?? capitalize(item.status_id)}
                </span>
                <span className="similar-item-score">
                  {Math.round(item.score * 100)}% match
                </span>
              </span>
            </Link>
          );
        })}
    </div>
  );
};

export default SimilarReports;
