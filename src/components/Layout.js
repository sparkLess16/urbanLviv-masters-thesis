import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import "../styles/Layout.css";
import Header from "./Header";

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user?.role;
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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

  return (
    <div className="app-container">
      <Header />
      <main>{children}</main>
    </div>
  );
};

export default Layout;
