import "../styles/Support.css";

const people = (count) => `${count} ${count === 1 ? "person" : "people"}`;

// Blue pill "Supported by N" (lists) or "Supported by N people" (report page).
// Nothing is shown when nobody supports the report.
const SupportPill = ({ count, long = false }) => {
  if (!count) return null;
  return (
    <span className="sup-pill-blue">
      Supported by {long ? people(count) : count}
    </span>
  );
};

export default SupportPill;
