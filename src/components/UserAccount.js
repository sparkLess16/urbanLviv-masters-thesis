import React from "react";
import { getUserName } from "../utils/userName";
import { useState, useEffect, useRef } from "react";
import myImage from "../assets/useraccount.png";
import "../styles/UserAccount.css";
import Tabs from "./Tabs";
import ReportForm from "./ReportForm";
import TopProblemTypes from "./TopProblemTypes";
import CityAnalytics from "./CityAnalytics";
import ClusterExplorer from "./ClusterExplorer";

import axios from "axios";

const UserAccount = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isOpenNotif, setIsOpenNotif] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [notificationsData, setNotificationsData] = useState([]);
  const [isUserViewingNotif, setIsUserViewingNotif] = useState(false);

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  const openNotif = () => {
    setIsUserViewingNotif(true);
    setIsOpenNotif(true);
    markAllNotificationsAsViewed();
  };

  const closeNotif = () => {
    setIsUserViewingNotif(false);
    setIsOpenNotif(false);
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchUnread();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [isUserViewingNotif]);

  const [shouldRefreshReports, setShouldRefreshReports] = useState(false);

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const fullName = getUserName(user.data || user);
  const firstName = fullName.split(" ")[0];
  const formattedName = fullName;

  const handleReportSubmitted = async () => {
    setShouldRefreshReports(true);
    tryUpdateNotifications();
  };

  const fetchUnread = async () => {
    try {
      const token = localStorage.getItem("authToken");

      const resp = await axios.get(
        "http://localhost:5000/api/notifications/not-viewed",
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      setUnreadNotifs(resp.data.count || 0);
    } catch (err) {
      console.error("Error fetching unread notifications:", err);
      setUnreadNotifs(0);
    }
  };

  const fetchAll = async () => {
    try {
      const token = localStorage.getItem("authToken");

      const resp = await axios.get("http://localhost:5000/api/notifications", {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      return resp.data || [];
    } catch (err) {
      console.error("Error fetching all notifications:", err);
      return [];
    }
  };
  useEffect(() => {
    fetchUnread();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const allNotifications = await fetchAll();
      setNotificationsData(allNotifications);
    };
    loadData();
  }, []);

  const tryUpdateNotifications = async (attempt = 0) => {
    if (attempt >= 5) return;

    const prevCount = unreadNotifs;
    await fetchUnread();

    if (unreadNotifs !== prevCount) {
      const all = await fetchAll();
      setNotificationsData(all);
    } else {
      setTimeout(() => tryUpdateNotifications(attempt + 1), 8000);
    }
  };

  const markAllNotificationsAsViewed = async () => {
    try {
      const token = localStorage.getItem("authToken");

      await axios.patch(
        "http://localhost:5000/api/notifications/mark-viewed",
        {},
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      setUnreadNotifs(0);
    } catch (err) {
      console.error("Error marking notifications as viewed:", err);
    }
  };

  const useClickOutside = (ref, callback, active = true) => {
    useEffect(() => {
      if (!active) return;

      const handleClick = (e) => {
        if (ref.current && !ref.current.contains(e.target)) {
          callback();
        }
      };

      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [ref, callback, active]);
  };

  const notifRef = useRef(null);
  useClickOutside(notifRef, closeNotif, isOpenNotif);

  return (
    <div className="userAccount">
      <img src={myImage} alt="Description" className="top-pic" />
      <div className="top-info">
        <div className="headline">
          <h2 className="name">👋 Welcome Back, {firstName}!</h2>
        </div>
        <p className="decription padding">
          Here, you can easily report any issues you encounter around the city.
        </p>
        <CityAnalytics refreshKey={shouldRefreshReports} />
        <TopProblemTypes />
        <ClusterExplorer />
      </div>

      <div className="container-useraccount">
        <div className="right-side">
          <Tabs
            shouldRefresh={shouldRefreshReports}
            onRefreshed={() => setShouldRefreshReports(false)}
          />
        </div>
        <div className="left-side">
          <ReportForm onSubmitted={handleReportSubmitted} />
        </div>
      </div>
    </div>
  );
};

export default UserAccount;
