import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import SupportPointMap, { MAX_SUPPORT_DISTANCE_M } from "./SupportPointMap";
import { HintMeta } from "./HintCard";
import { supportReport, updateSupport } from "../services/supportApi";
import { distanceMeters } from "../utils/geo";
import "../styles/Support.css";

const MAX_COMMENT_LENGTH = 500;

// The place the person saw the problem: the point marked in the report form
// when it is close to the report, otherwise the report's own point.
const initialPoint = (item, formPoint) => {
  if (!item.point) return null;
  if (
    formPoint &&
    distanceMeters(item.point, formPoint) <= MAX_SUPPORT_DISTANCE_M
  ) {
    return formPoint;
  }
  return item.point;
};

// Two modes:
//   "create": "Support this report?" with an optional comment and point;
//   "edit":   change the comment or the marked point of one's own support,
//             or stop supporting (onStop asks for confirmation).
const SupportDialog = ({
  item,
  typeName,
  formPoint,
  mode = "create",
  initial = { comment: "", point: null },
  onClose,
  onSupported,
  onStop,
}) => {
  const isEdit = mode === "edit";
  const titleId = useId();
  const start = isEdit
    ? (initial.point ?? item.point)
    : initialPoint(item, formPoint);
  const [comment, setComment] = useState(isEdit ? initial.comment : "");
  const [markPoint, setMarkPoint] = useState(
    isEdit ? Boolean(initial.point) : Boolean(start),
  );
  const [point, setPoint] = useState(start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const placePart =
      markPoint && point ? { lat: point.lat, lng: point.lng } : {};
    try {
      const data = isEdit
        ? await updateSupport(item.reportId, {
            comment: comment.trim(),
            ...placePart,
          })
        : await supportReport(item.reportId, {
            comment: comment.trim() || undefined,
            ...placePart,
            via: "hint",
            score: item.score,
          });
      onSupported(item, data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not save your support. Please try again.",
      );
      setBusy(false);
    }
  };

  // In the body: a sticky parent would put the dialog below the page header.
  return createPortal(
    <div className="sup-overlay">
      <div
        className="sup-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div>
          <h3 id={titleId} className="sup-dialog-title">
            {isEdit ? "Edit your support" : "Support this report?"}
          </h3>
          <p className="sup-dialog-sub">
            {isEdit
              ? "Change your comment or the place you marked."
              : "You will be notified when its status changes."}
          </p>
        </div>

        <div className="sup-summary">
          <strong>{item.title}</strong>
          <HintMeta
            typeName={typeName}
            distance={item.distance_m}
            createdAt={item.created_dt}
          />
        </div>

        <div className="sup-field">
          <label className="sup-field-label" htmlFor="support-comment">
            {isEdit ? "Your comment" : "Anything to add?"}{" "}
            <span>(optional)</span>
          </label>
          <textarea
            id="support-comment"
            value={comment}
            maxLength={MAX_COMMENT_LENGTH}
            placeholder="For example: the hole got bigger since yesterday"
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        {item.point && (
          <div className="sup-field">
            <label className="sup-check">
              <input
                type="checkbox"
                checked={markPoint}
                onChange={(e) => setMarkPoint(e.target.checked)}
              />
              Mark where I saw it on the map
            </label>
            {markPoint && (
              <SupportPointMap
                origin={item.point}
                value={point}
                onChange={setPoint}
              />
            )}
          </div>
        )}

        {error && <p className="sup-error">{error}</p>}

        <div className="sup-actions">
          <button
            type="button"
            className="sup-btn-light is-large"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="sup-btn is-large is-primary"
            onClick={submit}
            disabled={busy}
          >
            {busy
              ? isEdit
                ? "Saving..."
                : "Supporting..."
              : isEdit
                ? "Save changes"
                : "Support report"}
          </button>
        </div>

        {isEdit && onStop && (
          <button
            type="button"
            className="sup-link sup-link-danger"
            onClick={onStop}
            disabled={busy}
          >
            Stop supporting this report
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default SupportDialog;
