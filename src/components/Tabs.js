import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import Report from "./Report";
import "../styles/UserAccount.css";

const Tabs = ({ shouldRefresh, onRefreshed }) => {
  const [activeTab, setActiveTab] = useState("all");
  const [counts, setCounts] = useState({ total_reports: 0, user_reports: 0 });
  const [allReports, setAllReports] = useState([]);
  const [userReports, setUserReports] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const [topReports, setTopReports] = useState([]);

  const fetchAll = async () => {
    const token = localStorage.getItem("authToken");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    try {
      const allRes = await axios.get("http://localhost:5000/api/reports", {
        headers,
      });

      const allItems = Array.isArray(allRes.data) ? allRes.data : [];

      setAllReports(allItems);

      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.id || user._id || user.data?.user_id;

      const filteredUserReports = allItems.filter((report) => {
        const createdById =
          report.created_by?._id || report.created_by?.id || report.created_by;

        return createdById?.toString() === userId?.toString();
      });

      setUserReports(filteredUserReports);

      setCounts({
        total_reports: allItems.length,
        user_reports: filteredUserReports.length,
      });
    } catch (err) {
      console.error("Fetching reports failed", err);
    }
  };
  const fetchTop = async () => {
    try {
      const token = localStorage.getItem("authToken");

      const res = await axios.get("http://localhost:5000/api/reports/top", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setTopReports(res.data);
    } catch (err) {
      console.error("Failed to fetch top reports", err);
    }
  };

  useEffect(() => {
    fetchAll();
    fetchTop();
  }, []);

  useEffect(() => {
    if (shouldRefresh) {
      fetchAll();
      onRefreshed();
    }
  }, [shouldRefresh]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const currentReports =
    activeTab === "all"
      ? allReports
      : activeTab === "yours"
        ? userReports
        : topReports;
  const filteredReports = currentReports.filter((report) =>
    report.title?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <>
      <div className="tabs-row">
        <div className="tabs">
          <button
            className={`tab ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All <span className="count">{counts.total_reports}</span>
          </button>

          <button
            className={`tab ${activeTab === "top" ? "active" : ""}`}
            onClick={async () => {
              await fetchTop();
              setActiveTab("top");
            }}
          >
            Top <span className="count">{topReports.length}</span>
          </button>

          <button
            className={`tab ${activeTab === "yours" ? "active" : ""}`}
            onClick={() => setActiveTab("yours")}
          >
            Yours <span className="count">{counts.user_reports}</span>
          </button>
        </div>

        <div
          ref={searchRef}
          className={`search-control ${isSearchOpen ? "open" : ""}`}
        >
          <button
            className="search-icon-btn"
            title="Search"
            onClick={() => setIsSearchOpen((prev) => !prev)}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M15 15L21 21M10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10C17 13.866 13.866 17 10 17Z"
                stroke="black"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>

          <input
            autoFocus={isSearchOpen}
            type="text"
            placeholder="Type to search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="inline-search-input"
          />
        </div>
      </div>
      <div className="tab-content">
        {filteredReports.map((r) => (
          <Report key={r.reportId || r._id} data={r} />
        ))}
      </div>
    </>
  );
};

export default Tabs;
