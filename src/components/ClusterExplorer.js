import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ClusterList from "./ClusterList";
import ClusterMap from "./ClusterMap";
import Select from "./Select";
import {
  fetchCluster,
  fetchClusters,
  fetchDistrictBorders,
  fetchDistricts,
  fetchTypes,
} from "../services/clusterApi";
import {
  STATUS_FILTERS,
  plainDistrictName,
  reportsLabel,
} from "../utils/clusterLabels";
import "../styles/ClusterExplorer.css";

const toNameMap = (items, clean = (name) => name) =>
  Object.fromEntries(items.map((item) => [item.id, clean(item.name)]));

// FR-05 + FR-08: clusters of similar reports, filtered by district and status,
// as a list and as numbered markers on the map.
const ClusterExplorer = () => {
  const navigate = useNavigate();
  const [districtId, setDistrictId] = useState("all");
  const [status, setStatus] = useState("open");
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const [districtNames, setDistrictNames] = useState({});
  const [typeNames, setTypeNames] = useState({});
  const [borders, setBorders] = useState(null);
  const detailRequest = useRef(0);

  // Lookups: a failure only costs labels or borders, never the clusters.
  useEffect(() => {
    fetchDistricts()
      .then((items) => setDistrictNames(toNameMap(items, plainDistrictName)))
      .catch(() => {});
    fetchTypes()
      .then((items) => setTypeNames(toNameMap(items)))
      .catch(() => {});
    fetchDistrictBorders()
      .then(setBorders)
      .catch(() => {});
  }, []);

  const clearSelection = useCallback(() => {
    detailRequest.current += 1;
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
  }, []);

  const loadClusters = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    clearSelection();
    fetchClusters({ district_id: districtId, status })
      .then((items) => {
        if (!cancelled) setClusters(items);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load clusters");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [districtId, status, clearSelection]);

  useEffect(() => loadClusters(), [loadClusters]);

  const selectCluster = (id) => {
    const request = detailRequest.current + 1;
    detailRequest.current = request;
    setSelectedId(id);
    setDetail(null);
    setDetailError(null);
    fetchCluster(id)
      .then((data) => {
        if (detailRequest.current === request) setDetail(data);
      })
      .catch(() => {
        if (detailRequest.current === request) {
          setDetailError("Could not load the reports of this cluster");
        }
      });
  };

  const totalReports = useMemo(
    () => clusters.reduce((sum, cluster) => sum + cluster.reports_count, 0),
    [clusters],
  );
  const selected = clusters.find((cluster) => cluster.id === selectedId);
  const districtOptions = useMemo(
    () => [
      { value: "all", label: "All districts" },
      ...Object.entries(districtNames).map(([value, label]) => ({
        value,
        label,
      })),
    ],
    [districtNames],
  );

  return (
    <section className="cx-card" aria-label="Problem clusters">
      <ClusterMap
        clusters={clusters}
        detail={detail}
        borders={borders}
        districtNames={districtNames}
        onSelectCluster={selectCluster}
        onOpenReport={(id) => navigate(`/userAccount/${id}`)}
      />

      <div className="cx-panel">
        <div className="cx-panel-head">
          <div className="cx-title-row">
            <h2>Problem clusters</h2>
            {!loading && !error && (
              <span className="cx-summary">
                {clusters.length}{" "}
                {clusters.length === 1 ? "cluster" : "clusters"} ·{" "}
                {reportsLabel(totalReports)}
              </span>
            )}
          </div>
          <div className="cx-filters">
            <div className="cx-field">
              <label htmlFor="cx-district">District</label>
              <Select
                id="cx-district"
                value={districtId}
                onChange={setDistrictId}
                options={districtOptions}
              />
            </div>
            <div className="cx-field">
              <label htmlFor="cx-status">Status</label>
              <Select
                id="cx-status"
                value={status}
                onChange={setStatus}
                options={STATUS_FILTERS}
              />
            </div>
          </div>
        </div>

        <div className="cx-panel-body">
          {loading && <p className="cx-state">Loading clusters…</p>}
          {error && (
            <p className="cx-state" role="alert">
              {error}{" "}
              <button type="button" className="cx-link" onClick={loadClusters}>
                Try again
              </button>
            </p>
          )}
          {!loading && !error && clusters.length === 0 && (
            <p className="cx-state">No clusters for these filters.</p>
          )}
          {!loading && !error && clusters.length > 0 && (
            <ClusterList
              clusters={clusters}
              selectedId={selectedId}
              districtNames={districtNames}
              typeNames={typeNames}
              showStatus={status === "all"}
              onSelect={selectCluster}
            />
          )}
        </div>
      </div>

      {selected && (
        <div className="cx-banner" role="status">
          <span>
            {detailError ?? (
              <>
                <strong>{reportsLabel(selected.reports_count)}</strong> in “
                {detail?.title ?? selected.title ?? "Untitled problem"}”
              </>
            )}
          </span>
          <button type="button" onClick={clearSelection}>
            Show all clusters
          </button>
        </div>
      )}

      <div className="cx-legend" aria-label="Map legend">
        <span>
          <i className="cx-key cx-key--count">3</i>Reports in the cluster
        </span>
        <span>
          <i className="cx-key cx-key--active" />
          Open
        </span>
        <span>
          <i className="cx-key cx-key--resolved" />
          Resolved
        </span>
        <span>
          <i className="cx-key cx-key--closed" />
          Closed
        </span>
        <span>
          <i className="cx-key cx-key--border" />
          District border
        </span>
      </div>
    </section>
  );
};

export default ClusterExplorer;
