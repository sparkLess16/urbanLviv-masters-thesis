import { useEffect, useRef } from "react";
import { CLUSTER_STATUS_LABELS, reportsLabel } from "../utils/clusterLabels";

const PinIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
    <circle cx="12" cy="9" r="2.5" />
  </svg>
);

// FR-05 list: the name of the problem, where, who handles it. Selecting a
// cluster shows its reports on the map.
const ClusterList = ({
  clusters,
  selectedId,
  districtNames,
  typeNames,
  showStatus,
  onSelect,
}) => {
  const selectedRef = useRef(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [selectedId]);

  return (
    <ul className="cx-list">
      {clusters.map((cluster) => {
        const selected = cluster.id === selectedId;
        return (
          <li key={cluster.id}>
            <button
              type="button"
              ref={selected ? selectedRef : null}
              className={`cx-row${selected ? " is-selected" : ""}`}
              aria-current={selected ? "true" : undefined}
              onClick={() => onSelect(cluster.id)}
            >
              <span
                className={`cx-badge cx-badge--${cluster.status}`}
                aria-label={reportsLabel(cluster.reports_count)}
              >
                {cluster.reports_count}
              </span>
              <span className="cx-row-body">
                <strong className="cx-row-title">
                  {cluster.title ?? "Untitled problem"}
                </strong>
                <span className="cx-row-tags">
                  <span className="cx-tag cx-tag--district">
                    <PinIcon />
                    {districtNames[cluster.district_id] ?? cluster.district_id}
                  </span>
                  <span className="cx-tag">
                    {typeNames[cluster.type_id] ?? cluster.type_id}
                  </span>
                  {showStatus && (
                    <span className={`cx-pill cx-pill--${cluster.status}`}>
                      {CLUSTER_STATUS_LABELS[cluster.status]}
                    </span>
                  )}
                  {cluster.in_progress_count > 0 && (
                    <span className="cx-row-meta">
                      {cluster.in_progress_count} in progress
                    </span>
                  )}
                </span>
                <span className="cx-row-service">
                  Handled by <strong>{cluster.responsible_service}</strong>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default ClusterList;
