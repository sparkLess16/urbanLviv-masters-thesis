import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Report.css";
import "../styles/ReportView.css";
import axios from "axios";
import SupportPill from "./SupportPill";
import ConfirmDialog from "./ConfirmDialog";
import { stopSupportingReport } from "../services/supportApi";
import { formatDate } from "../utils/formatDate";
import { stripLeadingEmoji } from "../utils/text";

// showStopSupporting: the "Supported" tab shows a button to stop supporting.
const Report = ({ data, showStopSupporting = false, onSupportChange }) => {
  const navigate = useNavigate();
  const {
    status_name,
    status_color,
    title,
    created_dt,
    description,
    location,
    district_name,
    attachment_urls,
    total_likes,
    total_dislikes,
  } = data;

  const attachments = attachment_urls
    ? (Array.isArray(attachment_urls)
        ? attachment_urls
        : [attachment_urls]
      ).map((item) => item.Content)
    : [];

  const [comments, setComments] = useState(data.comments || []);
  const [commentInput, setCommentInput] = useState("");
  const [showAllComments, setShowAllComments] = useState(false);
  const [userReaction, setUserReaction] = useState(data.user_reaction || null);
  const [confirmStop, setConfirmStop] = useState(false);

  const stopSupporting = async () => {
    try {
      const id = data.reportId || data.report_id;
      const result = await stopSupportingReport(id);
      setConfirmStop(false);
      if (onSupportChange) onSupportChange(id, result);
    } catch (err) {
      console.error("Stop supporting failed", err);
    }
  };

  const [likes, setLikes] = useState(total_likes || 0);
  const [dislikes, setDislikes] = useState(total_dislikes || 0);

  useEffect(() => {
    setLikes(data.total_likes || 0);
    setDislikes(data.total_dislikes || 0);
    setUserReaction(data.user_reaction || null);
    setComments(data.comments || []);
  }, [data]);

  const handleReportClick = (reportId) => {
    navigate(`/userAccount/${reportId}`);
  };

  const handleAddComment = async () => {
    if (!commentInput.trim()) return;

    const reportId = data?.reportId?.toString() || data?.report_id?.toString();
    if (!reportId) {
      console.error("Report ID is missing — cannot submit comment.");
      return;
    }

    try {
      const token = localStorage.getItem("authToken");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await axios.post(
        `http://localhost:5000/api/comments/report/${reportId}`,
        { comment_content: commentInput },
        { headers },
      );

      setComments((prev) => [...prev, res.data]);
      setCommentInput("");
    } catch (err) {
      console.error("Помилка при додаванні коментаря:", err);
    }
  };

  const handleLike = async () => {
    const reportId = data.reportId?.toString() || data.report_id?.toString();

    try {
      const token = localStorage.getItem("authToken");

      const res = await axios.post(
        `http://localhost:5000/api/reactions/report/${reportId}`,
        { type: "like" },
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      setLikes(res.data.total_likes);
      setDislikes(res.data.total_dislikes);
      setUserReaction(res.data.user_reaction);
    } catch (err) {
      console.error("Помилка при створенні/скасуванні реакції:", err);
    }
  };

  const handleDislike = async () => {
    const reportId = data.reportId?.toString() || data.report_id?.toString();

    try {
      const token = localStorage.getItem("authToken");

      const res = await axios.post(
        `http://localhost:5000/api/reactions/report/${reportId}`,
        { type: "dislike" },
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      setLikes(res.data.total_likes);
      setDislikes(res.data.total_dislikes);
      setUserReaction(res.data.user_reaction);
    } catch (err) {
      console.error("Помилка при створенні/скасуванні реакції:", err);
    }
  };

  // Newest comment first; two are shown until "See more".
  const newestFirst = [...comments].sort(
    (a, b) => new Date(b.created_dt) - new Date(a.created_dt),
  );
  const metaLine = [data.type_name, stripLeadingEmoji(district_name), location]
    .filter(Boolean)
    .join(" · ");
  const stop = (handler) => (e) => {
    e.stopPropagation();
    handler();
  };

  return (
    <div
      className="report-card"
      onClick={() =>
        handleReportClick(
          data?.reportId?.toString() || data?.report_id?.toString(),
        )
      }
    >
      <div className="report-status" style={{ backgroundColor: status_color }}>
        {status_name}
      </div>
      <div className="report-header">
        <div className="title-istop5">
          {data.is_top_report && (
            <div className="top-report-badge">🏆 Top 5</div>
          )}
          <p className="report-main-title">{title}</p>
        </div>
        <span className="report-date">{formatDate(created_dt)}</span>
      </div>
      {metaLine && <p className="rc-meta">{metaLine}</p>}

      <p className="report-description">{description}</p>

      {attachments.length > 0 && (
        <div className="report-images">
          {attachments.map((src, i) => (
            <img key={i} src={src} alt={`attachment-${i}`} />
          ))}
        </div>
      )}

      <div className="rc-actions">
        <div className="rp-reactions">
          <button
            type="button"
            className={`rp-react${userReaction === "like" ? " is-active" : ""}`}
            aria-label={`Like, ${likes}`}
            aria-pressed={userReaction === "like"}
            onClick={stop(handleLike)}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 11v9H4v-9h3zM7 11l4-8c1.5 0 2.5 1 2.5 2.5V9h5a2 2 0 012 2.3l-1.2 7A2 2 0 0117.3 20H7" />
            </svg>
            {likes}
          </button>
          <button
            type="button"
            className={`rp-react${userReaction === "dislike" ? " is-active" : ""}`}
            aria-label={`Dislike, ${dislikes}`}
            aria-pressed={userReaction === "dislike"}
            onClick={stop(handleDislike)}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ transform: "rotate(180deg)" }}
            >
              <path d="M7 11v9H4v-9h3zM7 11l4-8c1.5 0 2.5 1 2.5 2.5V9h5a2 2 0 012 2.3l-1.2 7A2 2 0 0117.3 20H7" />
            </svg>
            {dislikes}
          </button>
        </div>

        <div className="rc-support">
          <SupportPill count={data.supported_by_count} />
          {showStopSupporting && data.supported_by_me && (
            <button
              type="button"
              className="sup-btn-light"
              onClick={stop(() => setConfirmStop(true))}
            >
              Stop supporting
            </button>
          )}
        </div>
      </div>

      <div className="rp-comments rc-comments">
        <div className="rc-comments-head">
          <h3 className="rp-section-title">Comments</h3>
          {comments.length > 2 && (
            <button
              className="see-more-comments-btn"
              onClick={stop(() => setShowAllComments(!showAllComments))}
            >
              {showAllComments ? "Hide" : `See more (${comments.length - 2})`}
            </button>
          )}
        </div>

        {(showAllComments ? newestFirst : newestFirst.slice(0, 2)).map(
          (comment, index) => (
            <article className="rp-comment" key={comment.id || index}>
              <div className="rp-comment-head">
                <b>{comment.created_by}</b>
                {comment.created_by_role_name === "Administrator" && (
                  <span className="admin-label">Admin</span>
                )}
                <span className="rp-comment-time">
                  {new Date(comment.created_dt).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="rp-comment-text">{comment.comment_content}</p>
            </article>
          ),
        )}

        {!["Cancelled", "Resolved", "Rejected"].includes(status_name) && (
          <div className="rp-comment-input">
            <input
              type="text"
              id="commentText"
              placeholder="Write a comment…"
              value={commentInput}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddComment();
              }}
            />
            <button
              type="button"
              id="submitComment"
              className="rp-send"
              aria-label="Send comment"
              onClick={stop(handleAddComment)}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M3.61088 12.8685C3.02755 12.8685 2.46172 12.641 2.01255 12.2035C1.28338 11.4918 1.10838 10.4418 1.56338 9.53182L2.50838 7.64182C2.70672 7.24516 2.70672 6.76682 2.50838 6.36432L1.56338 4.46849C1.10838 3.55849 1.28338 2.50849 2.01255 1.79682C2.74172 1.08516 3.79172 0.927656 4.69588 1.40599L11.4567 4.96432C12.2151 5.36099 12.6876 6.14266 12.6876 7.00016C12.6876 7.85766 12.2151 8.63932 11.4567 9.03599L4.69588 12.5943C4.34588 12.781 3.97838 12.8685 3.61088 12.8685Z"
                  fill="white"
                />
              </svg>
            </button>
          </div>
        )}
      </div>

      {confirmStop && (
        <div onClick={(e) => e.stopPropagation()}>
          <ConfirmDialog
            icon="warning"
            message={[
              "Stop supporting this report?",
              "You will no longer be notified when its status changes.",
            ]}
            buttons={[
              {
                label: "Keep supporting",
                variant: "primary",
                onClick: () => setConfirmStop(false),
              },
              {
                label: "Yes, stop supporting",
                variant: "destructive",
                onClick: stopSupporting,
              },
            ]}
          />
        </div>
      )}
    </div>
  );
};

export default Report;
