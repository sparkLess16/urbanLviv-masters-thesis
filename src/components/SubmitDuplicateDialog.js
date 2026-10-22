import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { HintMeta } from "./HintCard";
import "../styles/Support.css";

// Shown on Submit when a very similar report is found nearby. The report is
// not created yet: the person picks what happens next.
const SubmitDuplicateDialog = ({
  item,
  typeName,
  busy,
  error,
  onSupport,
  onSeparate,
  onBack,
}) => {
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) onBack();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onBack]);

  // In the body: a sticky parent would put the dialog below the page header.
  return createPortal(
    <div className="sup-overlay">
      <div
        className="sup-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="sup-dialog-head">
          <span className="sup-warning-icon">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16.5v.5" />
            </svg>
          </span>
          <div>
            <h3 id={titleId} className="sup-dialog-title">
              This looks like an existing report
            </h3>
            <p className="sup-dialog-sub">
              Is it the same problem you are reporting?
            </p>
          </div>
        </div>

        <div className="sup-summary">
          <div className="sup-card-head">
            <strong>{item.title}</strong>
            <span className="sup-pill-green">{item.match_percent}% match</span>
          </div>
          {item.description && (
            <p className="sup-card-text">{item.description}</p>
          )}
          <HintMeta
            typeName={typeName}
            distance={item.distance_m}
            createdAt={item.created_dt}
          />
          <a
            className="sup-link"
            href={`/userAccount/${item.reportId}`}
            target="_blank"
            rel="noreferrer"
          >
            View full report
          </a>
        </div>

        <p className="sup-card-text">
          If you support it, you will be notified when its status changes.
        </p>

        {error && <p className="sup-error">{error}</p>}

        <div className="sup-actions-column">
          <button
            type="button"
            className="sup-btn is-large"
            onClick={onSupport}
            disabled={busy}
          >
            {busy ? "Supporting..." : "Support this report"}
          </button>
          <button
            type="button"
            className="sup-btn-light is-large"
            onClick={onSeparate}
            disabled={busy}
          >
            No, submit as a separate report
          </button>
          <button
            type="button"
            className="sup-link"
            onClick={onBack}
            disabled={busy}
          >
            Back to editing
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default SubmitDuplicateDialog;
