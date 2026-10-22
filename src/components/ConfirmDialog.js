import React from "react";
import "../styles/ConfirmDialog.css";

const ICONS = {
  success: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  warning: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16.5v.5" />
    </>
  ),
};

// `icon` is optional: "success" or "warning" puts a round icon above the title.
const ConfirmDialog = ({ message, buttons = [], icon }) => {
  return (
    <div className="confirm-overlay">
      <div className="confirm-box">
        {icon && ICONS[icon] && (
          <div className={`confirm-icon is-${icon}`} aria-hidden="true">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {ICONS[icon]}
            </svg>
          </div>
        )}
        {Array.isArray(message) ? (
          message.map((line, idx) =>
            idx === 0 ? (
              <p key={idx}>
                <strong>{line}</strong>
              </p>
            ) : (
              <p key={idx}>{line}</p>
            ),
          )
        ) : (
          <p>
            <strong>{message}</strong>
          </p>
        )}

        <div className="confirm-buttons">
          {buttons.map((btn, idx) => (
            <button
              key={idx}
              className={btn.variant || "default"}
              onClick={btn.onClick}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
