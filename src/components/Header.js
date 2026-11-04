import axios from "axios";
import { getUserName } from "../utils/userName";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import "../styles/UserAccount.css";
import Notifications from "./Notifications";
import EditForm from "./EditForm";

const Header = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userData = user.data || user;
  const role = user?.role;
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isOpenNotif, setIsOpenNotif] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [notificationsData, setNotificationsData] = useState([]);
  const notifRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    setIsAuthenticated(!!token);
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    setIsAuthenticated(false);
    navigate("/login");
  };

  const fetchUnread = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(
        "http://localhost:5000/api/notifications/not-viewed",
        { headers },
      );
      setUnreadNotifs(res.data.count || 0);
    } catch (error) {
      console.error("Failed to fetch unread notifications", error);
    }
  };

  const fetchAllNotifications = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get("http://localhost:5000/api/notifications", {
        headers,
      });
      setNotificationsData(res.data);
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    }
  };

  const markAllNotificationsAsViewed = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const headers = { Authorization: `Bearer ${token}` };
      await axios.patch(
        "http://localhost:5000/api/notifications/mark-viewed",
        {},
        { headers },
      );
      setUnreadNotifs(0);
    } catch (error) {
      console.error("Failed to mark notifications", error);
    }
  };
  const openNotif = async () => {
    setIsOpenNotif(true);
    await fetchAllNotifications();
    await markAllNotificationsAsViewed();
  };
  const closeNotif = () => {
    setIsOpenNotif(false);
  };
  useEffect(() => {
    if (isAuthenticated) {
      fetchUnread();
    }
  }, [isAuthenticated]);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        closeNotif();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  return (
    <>
      <header className="app-header">
        <h1 className="logo" onClick={() => navigate("/")}>
          UrbanLviv
        </h1>
        <div className="header-buttons">
          {isAuthenticated && (
            <div className="header-right">
              <div className="header-left-icons">
                {role === "admin" && (
                  <button
                    className="header-icon-btn"
                    onClick={() => navigate("/adminPanel")}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M2 15.75V18.0002C2 19.4004 2 20.1001 2.27248 20.6349C2.51217 21.1053 2.89434 21.4881 3.36475 21.7278C3.899 22 4.59874 22 5.99614 22H12M2 15.75V8.25M2 15.75H12M2 8.25V6.00024C2 4.60011 2 3.89953 2.27248 3.36475C2.51217 2.89434 2.89434 2.51217 3.36475 2.27248C3.89953 2 4.60011 2 6.00024 2H12M2 8.25H12M12 2H18.0002C19.4004 2 20.1001 2 20.6349 2.27248C21.1053 2.51217 21.4881 2.89434 21.7278 3.36475C22 3.899 22 4.59874 22 5.99614V8.25M12 2V8.25M12 8.25V15.75M12 8.25H22M12 15.75V22M12 15.75H22M12 22H18.0045C19.4019 22 20.1006 22 20.6349 21.7278C21.1053 21.4881 21.4881 21.1053 21.7278 20.6349C22 20.1006 22 19.4019 22 18.0045V15.75M22 15.75V8.25"
                        stroke="#292D32"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </button>
                )}

                <div className="notif-wrapper">
                  <button
                    className={`header-icon-btn ${isOpenNotif ? "active" : ""}`}
                    onClick={openNotif}
                  >
                    <svg
                      width="24"
                      height="22"
                      viewBox="0 0 24 22"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M11.7933 19.35C9.4633 19.35 7.1333 18.98 4.9233 18.24C4.0833 17.95 3.44331 17.36 3.16331 16.59C2.87331 15.82 2.97331 14.9699 3.43331 14.2099L4.5833 12.2999C4.8233 11.8999 5.0433 11.0999 5.0433 10.6299V7.73995C5.0433 4.01995 8.0733 0.98999 11.7933 0.98999C15.5133 0.98999 18.5433 4.01995 18.5433 7.73995V10.6299C18.5433 11.0899 18.7633 11.8999 19.0033 12.3099L20.1433 14.2099C20.5733 14.9299 20.6533 15.8 20.3633 16.59C20.0733 17.38 19.4433 17.98 18.6533 18.24C16.4533 18.98 14.1233 19.35 11.7933 19.35ZM11.7933 2.48999C8.9033 2.48999 6.5433 4.83995 6.5433 7.73995V10.6299C6.5433 11.3599 6.2433 12.44 5.8733 13.07L4.7233 14.9799C4.5033 15.3499 4.4433 15.74 4.5733 16.07C4.6933 16.41 4.9933 16.6699 5.4033 16.8099C9.5833 18.2099 14.0133 18.2099 18.1933 16.8099C18.5533 16.6899 18.8333 16.4199 18.9633 16.0599C19.0933 15.6999 19.0633 15.3099 18.8633 14.9799L17.7133 13.07C17.3333 12.42 17.0433 11.3499 17.0433 10.6199V7.73995C17.0433 4.83995 14.6933 2.48999 11.7933 2.48999Z"
                        fill="#292D32"
                      />
                      <path
                        d="M13.654 2.76C13.584 2.76 13.514 2.75 13.444 2.73C13.154 2.65 12.874 2.59 12.604 2.55C11.754 2.44 10.934 2.5 10.164 2.73C9.88404 2.82005 9.58404 2.73 9.39404 2.52C9.20404 2.31 9.14404 2.01 9.25404 1.74C9.66404 0.69 10.664 0 11.804 0C12.944 0 13.944 0.68 14.354 1.74C14.454 2.01 14.404 2.31 14.214 2.52C14.064 2.68 13.854 2.76 13.654 2.76Z"
                        fill="#292D32"
                      />
                      <path
                        d="M11.793 21.6301C10.803 21.6301 9.84297 21.2301 9.14297 20.5301C8.44297 19.8301 8.04297 18.8701 8.04297 17.8801H9.54297C9.54297 18.4701 9.78297 19.0501 10.203 19.4701C10.623 19.8901 11.203 20.1301 11.793 20.1301C13.033 20.1301 14.043 19.1201 14.043 17.8801H15.543C15.543 19.9501 13.863 21.6301 11.793 21.6301Z"
                        fill="#292D32"
                      />
                    </svg>
                  </button>

                  {unreadNotifs > 0 && (
                    <span className="notif-count">{unreadNotifs}</span>
                  )}
                  {isOpenNotif && (
                    <div className="modal-overlay">
                      <div className="modal-content-notif" ref={notifRef}>
                        <h4 className="notificationBox">Notification Box</h4>

                        <div className="notif-scrollable">
                          <Notifications data={notificationsData} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="header-user-block">
                <div className="mock-avatar">
                  {userData.avatar_url ? (
                    <img
                      src={userData.avatar_url}
                      alt="User avatar"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M20 21C20 18.2386 16.4183 16 12 16C7.58172 16 4 18.2386 4 21M12 13C9.23858 13 7 10.7614 7 8C7 5.23858 9.23858 3 12 3C14.7614 3 17 5.23858 17 8C17 10.7614 14.7614 13 12 13Z"
                        stroke="#464646"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  )}
                </div>

                <div className="header-user-info">
                  <p className="header-user-name">
                    {getUserName(userData)}
                  </p>

                  <p className="header-user-email">{userData.email}</p>
                </div>
              </div>

              <div className="header-right-icons">
                <button
                  className="header-icon-btn header-edit-btn"
                  onClick={() => setIsOpen(true)}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M10.0002 4H7.2002C6.08009 4 5.51962 4 5.0918 4.21799C4.71547 4.40973 4.40973 4.71547 4.21799 5.0918C4 5.51962 4 6.08009 4 7.2002V16.8002C4 17.9203 4 18.4801 4.21799 18.9079C4.40973 19.2842 4.71547 19.5905 5.0918 19.7822C5.5192 20 6.07899 20 7.19691 20H16.8031C17.921 20 18.48 20 18.9074 19.7822C19.2837 19.5905 19.5905 19.2839 19.7822 18.9076C20 18.4802 20 17.921 20 16.8031V14M16 5L10 11V14H13L19 8M16 5L19 2L22 5L19 8M16 5L19 8"
                      stroke="#4A4A4A"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>

                <button className="header-icon-btn" onClick={handleSignOut}>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 15L15 12M15 12L12 9M15 12H4M4 7.24802V7.2002C4 6.08009 4 5.51962 4.21799 5.0918C4.40973 4.71547 4.71547 4.40973 5.0918 4.21799C5.51962 4 6.08009 4 7.2002 4H16.8002C17.9203 4 18.4796 4 18.9074 4.21799C19.2837 4.40973 19.5905 4.71547 19.7822 5.0918C20 5.5192 20 6.07899 20 7.19691V16.8036C20 17.9215 20 18.4805 19.7822 18.9079C19.5905 19.2842 19.2837 19.5905 18.9074 19.7822C18.48 20 17.921 20 16.8031 20H7.19691C6.07899 20 5.5192 20 5.0918 19.7822C4.71547 19.5905 4.40973 19.2839 4.21799 18.9076C4 18.4798 4 17.9201 4 16.8V16.75"
                      stroke="#4A4A4A"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>
      {isOpen && (
        <div className="modal" onClick={() => setIsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setIsOpen(false)}>
              ×
            </button>
            <EditForm
              onClose={() => setIsOpen(false)}
              onUpdate={() => window.location.reload()}
            />
          </div>
        </div>
      )}
    </>
  );
};
export default Header;
