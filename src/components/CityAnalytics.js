import { useEffect, useState } from "react";
import axios from "axios";
import "../styles/CityAnalytics.css";

const CityAnalytics = ({ refreshKey }) => {
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/analytics/overview")
      .then((res) => setAnalytics(res.data))
      .catch((err) => console.error("Failed to load analytics", err));
  }, [refreshKey]);

  const cards = [
    {
      label: "TOTAL",
      value: analytics?.totalReports ?? 0,
      suffix: "reports",
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M19.9991 13C19.9964 13.2855 19.9857 13.4659 19.9443 13.6384C19.8953 13.8424 19.8142 14.0379 19.7046 14.2168C19.5809 14.4186 19.4089 14.5916 19.063 14.9375L14.9375 19.063C14.5916 19.4089 14.4186 19.5814 14.2168 19.705C14.0379 19.8147 13.8429 19.8958 13.6388 19.9448C13.4663 19.9862 13.2857 19.9966 13 19.9991C12.9051 20 12.7986 20 12.677 20H7.19691C6.07899 20 5.5192 20 5.0918 19.7822C4.71547 19.5905 4.40973 19.2842 4.21799 18.9079C4 18.4801 4 17.9203 4 16.8002V7.2002C4 6.08009 4 5.51962 4.21799 5.0918C4.40973 4.71547 4.71547 4.40973 5.0918 4.21799C5.51962 4 6.08009 4 7.2002 4H16.8002C17.9203 4 18.4796 4 18.9074 4.21799C19.2837 4.40973 19.5905 4.71547 19.7822 5.0918C20 5.5192 20 6.07899 20 7.19691V12.6747C20 12.7973 20 12.9045 19.9991 13ZM13 19.9991V14.6001C13 14.04 13 13.7598 13.109 13.5459C13.2049 13.3577 13.3577 13.2049 13.5459 13.109C13.7598 13 14.0396 13 14.5996 13H19.9991"
            stroke="#6B7280"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      trend: "-18% vs last month",
    },
    {
      label: "RESOLVED",
      value: analytics?.resolvedReports ?? 0,
      suffix: "reports",
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M9 15L11 17L15 13M13 3.00087C12.9045 3 12.7973 3 12.6747 3H8.2002C7.08009 3 6.51962 3 6.0918 3.21799C5.71547 3.40973 5.40973 3.71547 5.21799 4.0918C5 4.51962 5 5.08009 5 6.2002V17.8002C5 18.9203 5 19.4801 5.21799 19.9079C5.40973 20.2842 5.71547 20.5905 6.0918 20.7822C6.51921 21 7.079 21 8.19694 21L15.8031 21C16.921 21 17.48 21 17.9074 20.7822C18.2837 20.5905 18.5905 20.2842 18.7822 19.9079C19 19.4805 19 18.9215 19 17.8036V9.32568C19 9.20296 19 9.09561 18.9991 9M13 3.00087C13.2856 3.00347 13.4663 3.01385 13.6388 3.05526C13.8429 3.10425 14.0379 3.18526 14.2168 3.29492C14.4186 3.41857 14.5918 3.59182 14.9375 3.9375L18.063 7.06298C18.4089 7.40889 18.5809 7.58136 18.7046 7.78319C18.8142 7.96214 18.8953 8.15726 18.9443 8.36133C18.9857 8.53376 18.9963 8.71451 18.9991 9M13 3.00087V5.8C13 6.9201 13 7.47977 13.218 7.90759C13.4097 8.28392 13.7155 8.59048 14.0918 8.78223C14.5192 9 15.079 9 16.1969 9H18.9991M18.9991 9H19.0002"
            stroke="#6B7280"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      trend: "vs last week",
    },
    {
      label: "AVG RESOLUTION TIME",
      value: analytics?.avgResolutionTimeDays ?? 0,
      suffix: "days",
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 13V9M21 6L19 4M10 2H14M12 21C7.58172 21 4 17.4183 4 13C4 8.58172 7.58172 5 12 5C16.4183 5 20 8.58172 20 13C20 17.4183 16.4183 21 12 21Z"
            stroke="#595E68"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      trend: "18% slower",
    },
    {
      label: "ACTIVE",
      value: analytics?.activeReports ?? 0,
      suffix: "reports",
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M15 10L11 14L9 12M12.0001 21C10.365 21 8.83174 20.5639 7.51025 19.8018C7.3797 19.7265 7.31434 19.6888 7.25293 19.6719C7.19578 19.6561 7.14475 19.6507 7.08559 19.6548C7.02253 19.6591 6.9573 19.6808 6.82759 19.7241L4.51807 20.4939L4.51625 20.4947C4.02892 20.6572 3.7848 20.7386 3.62256 20.6807C3.4812 20.6303 3.36979 20.5187 3.31938 20.3774C3.26157 20.2152 3.34268 19.9719 3.50489 19.4853L3.50586 19.4823L4.27468 17.1758L4.27651 17.171C4.31936 17.0424 4.34106 16.9773 4.34535 16.9146C4.3494 16.8554 4.34401 16.804 4.32821 16.7469C4.31146 16.6863 4.27448 16.6221 4.20114 16.495L4.19819 16.4899C3.43604 15.1684 3 13.6351 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9707 21 12.0001 21Z"
            stroke="#6B7280"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      trend: "vs last week",
    },
    {
      label: "CRITICAL",
      value: analytics?.criticalReports ?? 0,
      suffix: "reports",
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 9.00006V13.0001M4.37891 15.1999C3.46947 16.775 3.01489 17.5629 3.08281 18.2092C3.14206 18.7729 3.43792 19.2851 3.89648 19.6182C4.42204 20.0001 5.3309 20.0001 7.14853 20.0001H16.8515C18.6691 20.0001 19.5778 20.0001 20.1034 19.6182C20.5619 19.2851 20.8579 18.7729 20.9172 18.2092C20.9851 17.5629 20.5307 16.775 19.6212 15.1999L14.7715 6.79986C13.8621 5.22468 13.4071 4.43722 12.8135 4.17291C12.2957 3.94236 11.704 3.94236 11.1862 4.17291C10.5928 4.43711 10.1381 5.22458 9.22946 6.79845L4.37891 15.1999ZM12.0508 16.0001V16.1001L11.9502 16.1003V16.0001H12.0508Z"
            stroke="#6B7280"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      trend: "vs last week",
    },
  ];

  return (
    <section className="city-analytics">
      <div className="analytics-cards">
        {cards.map((card) => (
          <div key={card.label} className="analytics-card">
            <div className="inner-card">
              <div className="analytics-top-row">
                {card.icon}
                <p className="analytics-label">{card.label}</p>
              </div>
              <div className="analytics-bottom-row">
                <div className="analytics-value-row">
                  <span className="analytics-value">{card.value}</span>
                  <span className="analytics-suffix">{card.suffix}</span>
                </div>
                <svg
                  width="52"
                  height="45"
                  viewBox="0 0 52 45"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M2 44V16"
                    stroke="#C7C7C7"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M10 44L10 8"
                    stroke="#C7C7C7"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M18 44V16"
                    stroke="#C7C7C7"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M26 44L26 1"
                    stroke="black"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M34 44L34 24"
                    stroke="#C7C7C7"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M42 44V16"
                    stroke="#C7C7C7"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M50 44L50 14"
                    stroke="#C7C7C7"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
            <div className="analytics-trend">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect width="20" height="20" rx="10" fill="#FAE1E1" />
                <path
                  d="M12.1431 9.28577L10.0003 11.4286L7.85742 9.28577"
                  stroke="#D72727"
                  strokeWidth="1.07143"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              <span className="trend-text">{card.trend}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default CityAnalytics;
