import { useEffect, useState } from "react";
import "../styles/EditForm.css";
import ConfirmDialog from "./ConfirmDialog";
import { getUserName } from "../utils/userName";
import "../styles/UserAccount.css";

const EditForm = ({ onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

    setFormData({
      name: getUserName(storedUser),
      email: storedUser.email || "",
      password: "",
    });

    setAvatarPreview(storedUser.avatar_url || "");
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setRemoveAvatar(false);
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prevShowPassword) => !prevShowPassword);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData();
    form.append("name", formData.name);
    form.append("email", formData.email);

    if (formData.password.trim()) {
      form.append("password", formData.password);
    }

    if (avatarFile) {
      form.append("avatar", avatarFile);
    }
    form.append("removeAvatar", removeAvatar);

    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch("http://localhost:5000/api/users/me", {
        method: "PUT",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: form,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();

      const current = JSON.parse(localStorage.getItem("user") || "{}");

      const updatedUser = {
        ...current,
        ...data,
      };

      localStorage.setItem("user", JSON.stringify(updatedUser));
      window.dispatchEvent(new Event("userUpdated"));

      setShowSuccessDialog(true);
    } catch (error) {
      console.error("Update failed:", error);
      setShowErrorDialog(true);
    }
  };

  return (
    <div className="form-container">
      <form onSubmit={handleSubmit}>
        <div className="avatar-upload">
          <div className="edit-avatar-preview">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="User avatar preview"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span>👤</span>
            )}
          </div>

          <label className="avatar-camera-btn">
            📷
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              hidden
            />
          </label>
        </div>
        {avatarPreview && (
          <button
            type="button"
            className="remove-avatar-btn"
            onClick={() => {
              setAvatarFile(null);
              setAvatarPreview("");
              setRemoveAvatar(true);
            }}
          >
            Remove photo
          </button>
        )}
        <div className="input-group">
          <div className="input-field edit-form">
            <label htmlFor="name">Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="input-group">
          <div className="input-field">
            <label htmlFor="email">Email address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="input-field">
          <div className="label-with-eye">
            <label htmlFor="password">New Password</label>
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="eye-button"
            >
              {showPassword ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17.94 17.94A10.92 10.92 0 0 1 12 20c-7 0-11-8-11-8a21.53 21.53 0 0 1 5.17-6.58M3 3l18 18" />
                  <path d="M9.53 9.53A3.5 3.5 0 0 0 12 16a3.5 3.5 0 0 0 2.47-6.47" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          <input
            type={showPassword ? "text" : "password"}
            id="password"
            name="password"
            onChange={handleChange}
          />
        </div>

        <button type="submit" className="save-btn">
          Save
        </button>
      </form>
      {showSuccessDialog && (
        <ConfirmDialog
          message={["User information successfully updated!"]}
          buttons={[
            {
              label: "Okay",
              variant: "primary",
              onClick: () => {
                setShowSuccessDialog(false);
                if (onUpdate) onUpdate();
                if (onClose) onClose();
              },
            },
          ]}
        />
      )}

      {showSuccessDialog && (
        <ConfirmDialog
          message={["User information successfully updated!"]}
          buttons={[
            {
              label: "Okay",
              variant: "primary",
              onClick: () => {
                setShowSuccessDialog(false);
                if (onUpdate) onUpdate();
                if (onClose) onClose();
              },
            },
          ]}
        />
      )}
    </div>
  );
};

export default EditForm;
