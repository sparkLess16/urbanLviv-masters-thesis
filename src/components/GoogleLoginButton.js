import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import api from "../services/api";
import "../styles/GoogleLogin.css";

const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

// Sends the Google ID token to our backend and stores our own JWT, like a normal login.
const GoogleLoginButton = ({ onSuccess, onError }) => {
  if (!clientId) return null;

  const handleCredential = async ({ credential }) => {
    try {
      const { data } = await api.post("/api/auth/google", { credential });
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onSuccess();
    } catch (error) {
      onError(error.response?.data?.message || "Google sign-in failed.");
    }
  };

  return (
    <GoogleOAuthProvider clientId={clientId} locale="en">
      <div className="google-login">
        <GoogleLogin
          onSuccess={handleCredential}
          onError={() => onError("Google sign-in failed.")}
          text="continue_with"
          shape="pill"
          locale="en"
        />
      </div>
    </GoogleOAuthProvider>
  );
};

export default GoogleLoginButton;
