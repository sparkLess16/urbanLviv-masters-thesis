import "../styles/Support.css";
import { formatDate } from "../utils/formatDate";

const iconProps = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

// "Roads · 21.10.2026 · 30 m from your point" with icons.
export const HintMeta = ({ typeName, distance, createdAt }) => (
  <div className="sup-meta">
    {typeName && (
      <span>
        <svg {...iconProps}>
          <path d="M20 12l-8 8-9-9V3h8l9 9z" />
          <circle cx="7.5" cy="7.5" r="1.2" />
        </svg>
        {typeName}
      </span>
    )}
    {distance !== null && distance !== undefined && (
      <span>
        <svg {...iconProps}>
          <path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        {distance} m from your point
      </span>
    )}
    {createdAt && (
      <span>
        <svg {...iconProps}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M4 10h16M9 3v4M15 3v4" />
        </svg>
        {formatDate(createdAt)}
      </span>
    )}
  </div>
);

// One similar report. The report page opens in a new tab so that the form and
// everything typed in it stay as they are.
const HintCard = ({ item, typeName, supported, onSupport }) => (
  <div className="sup-card">
    <div className="sup-card-head">
      <h4 className="sup-card-title">{item.title}</h4>
      <span className="sup-pill-green">{item.match_percent}% match</span>
    </div>
    {item.description && <p className="sup-card-text">{item.description}</p>}
    <HintMeta
      typeName={typeName}
      distance={item.distance_m}
      createdAt={item.created_dt}
    />
    <div className="sup-card-foot">
      <a
        className="sup-link"
        href={`/userAccount/${item.reportId}`}
        target="_blank"
        rel="noreferrer"
      >
        View full report
      </a>
      {supported ? (
        <span className="sup-supported">
          <svg {...iconProps} strokeWidth={2.4}>
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          You support this
        </span>
      ) : (
        <button
          type="button"
          className="sup-btn"
          onClick={() => onSupport(item)}
        >
          Support report
        </button>
      )}
    </div>
  </div>
);

export default HintCard;
