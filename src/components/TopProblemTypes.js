import { useEffect, useRef, useState } from "react";
import axios from "axios";
import "../styles/TopProblemTypes.css";

const TopProblemTypes = () => {
  const [types, setTypes] = useState([]);
  const sliderRef = useRef(null);
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handleMouseDown = (e) => {
    isDown.current = true;
    startX.current = e.pageX - sliderRef.current.offsetLeft;
    scrollLeft.current = sliderRef.current.scrollLeft;
  };

  const handleMouseMove = (e) => {
    if (!isDown.current) return;

    e.preventDefault();

    const x = e.pageX - sliderRef.current.offsetLeft;
    const walk = (x - startX.current) * 0.6;

    sliderRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const stopDragging = () => {
    isDown.current = false;
  };

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/reports/top-types")
      .then((res) => setTypes(res.data))
      .catch((err) => console.error("Failed to load top problem types", err));
  }, []);

  return (
    <div
      className="top-types-section"
      ref={sliderRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={stopDragging}
      onMouseLeave={stopDragging}
    >
      {types.map((type) => (
        <div key={type.id} className={`top-type-card ${type.id}`}>
          <div className="top-type-emoji">{type.emoji}</div>
          <p className="top-type-name">{type.name}</p>
          <p className="top-type-count">{type.count}</p>
        </div>
      ))}
    </div>
  );
};

export default TopProblemTypes;
