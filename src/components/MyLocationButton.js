import "../styles/LocationPicker.css";

// Rendered inside the map (LocationPicker `overlay` prop).
const MyLocationButton = ({ onClick, isLocating }) => (
  <button
    type="button"
    className="map-locate-btn"
    onClick={onClick}
    disabled={isLocating}
  >
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
    {isLocating ? "Locating..." : "My location"}
  </button>
);

export default MyLocationButton;
