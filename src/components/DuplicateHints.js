import HintCard from "./HintCard";
import "../styles/Support.css";

// "Similar reports nearby" under the description. Shown only when there is
// something to show: the form is never blocked or cluttered by an empty state.
const DuplicateHints = ({ items, typeNameOf, supportedIds, onSupport }) => {
  if (items.length === 0) return null;

  return (
    <section className="sup-hints" aria-label="Similar reports nearby">
      <div>
        <h3 className="sup-hints-title">Similar reports nearby</h3>
        <p className="sup-hints-text">
          Already reported? Support an existing report instead of creating a new
          one.
        </p>
      </div>
      {items.map((item) => (
        <HintCard
          key={item.reportId}
          item={item}
          typeName={typeNameOf(item.type_id)}
          supported={supportedIds.has(item.reportId)}
          onSupport={onSupport}
        />
      ))}
    </section>
  );
};

export default DuplicateHints;
