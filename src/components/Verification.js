import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/Verification.css";

const Verification = () => {
  const location = useLocation();
  const hasRun = useRef(false);
  const navigate = useNavigate();
  const [ok, setOk] = useState(null);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const params = new URLSearchParams(location.search);
    const token = params.get("token");

    if (!token) {
      setOk(false);
      return;
    }

    axios
      .get(
        `http://localhost:5000/api/auth/verify-account?token=${encodeURIComponent(token)}`,
      )
      .then(() => setOk(true))
      .catch(() => setOk(false));
  }, [location.search]);

  if (ok === null) {
    return (
      <div className="verification-container">
        <h2 className="verification-title">Verifying…</h2>
        <p className="description">Please wait.</p>
      </div>
    );
  }

  return (
    <div className="verification-container">
      <h2 className="verification-title">
        {ok ? "Account Verified!" : "Verification Failed"}
      </h2>
      <p className="description">
        {ok
          ? "Your account has been successfully verified."
          : "Unable to verify your account. Please try again or contact support."}
      </p>
      <button
        className="login-button"
        onClick={() => navigate(ok ? "/login" : "/register")}
      >
        {ok ? "Go to Login" : "Back to Registration"}
      </button>
    </div>
  );
};

export default Verification;
