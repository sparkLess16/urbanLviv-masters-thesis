import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import * as Yup from "yup";
import { Formik, Form, Field, ErrorMessage } from "formik";
import "../styles/SignUp.css";
import myImage from "../assets/img2.jpg";
import ConfirmDialog from "./ConfirmDialog";
import GoogleLoginButton from "./GoogleLoginButton";

const Signup = () => {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState([]);

  const validationSchema = Yup.object().shape({
    name: Yup.string().trim().required("Name is required"),
    email: Yup.string()
      .email("Invalid email format")
      .required("Email is required"),
    password: Yup.string()
      .min(8, "Password must be at least 8 characters")
      .matches(/\d/, "Password must contain at least one number")
      .required("Password is required"),
    confirmPassword: Yup.string()
      .oneOf([Yup.ref("password"), null], "Passwords must match")
      .required("Confirm Password is required"),
  });

  const initialValues = {
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  };

  const handleSignUp = async (values, { setSubmitting, setErrors }) => {
    try {
      const response = await axios.post(
        "http://localhost:5000/api/auth/register",
        {
          name: values.name.trim(),
          email: values.email,
          password: values.password,
          confirmPassword: values.confirmPassword,
        },
      );

      const { token, user } = response.data;

      if (response.status === 201 || response.status === 200) {
        setConfirmMessage([
          "Registration successful!",
          "Account created successfully. Please check your email to verify your account.",
        ]);
        setShowConfirm(true);
      }
    } catch (error) {
      setErrors({
        server:
          error.response?.data?.message || "Sign-up failed, please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-container-img">
        <img src={myImage} alt="Description" className="img-signup" />
      </div>

      <div className="signup-container-content">
        <h2 className="signup-container-content-title">Create an account</h2>
        <p className="login-link">
          Already have an account? <Link to="/login">Login</Link>
        </p>
        <Formik
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={handleSignUp}
        >
          {({ isSubmitting, errors }) => (
            <Form className="addUserForm">
              {errors.server && (
                <p className="error-message">{errors.server}</p>
              )}
              <div className="inputGroup">
                <div className="form-group">
                  <label htmlFor="name">Name:</label>
                  <Field
                    type="text"
                    id="name"
                    name="name"
                    placeholder="Enter your full name"
                  />
                  <ErrorMessage
                    name="name"
                    component="p"
                    className="error-message"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email:</label>
                  <Field
                    type="email"
                    id="email"
                    name="email"
                    placeholder="Enter your email"
                  />
                  <ErrorMessage
                    name="email"
                    component="p"
                    className="error-message"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password:</label>
                  <Field
                    type="password"
                    id="password"
                    name="password"
                    placeholder="Enter password"
                  />
                  <ErrorMessage
                    name="password"
                    component="p"
                    className="error-message"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm Password:</label>
                  <Field
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    placeholder="Confirm your password"
                  />
                  <ErrorMessage
                    name="confirmPassword"
                    component="p"
                    className="error-message"
                  />
                </div>

                <p className="terms">
                  By creating account, you agree to Terms of use and Privacy
                  Policy
                </p>

                <button
                  type="submit"
                  className="signup-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Signing Up..." : "Create an Account"}
                </button>
              </div>
            </Form>
          )}
        </Formik>
        <p className="or-divider">or</p>
        <GoogleLoginButton
          onSuccess={() => navigate("/userAccount")}
          onError={(message) => {
            setConfirmMessage(["Sign-up failed", message]);
            setShowConfirm(true);
          }}
        />
      </div>
      {showConfirm && (
        <ConfirmDialog
          message={confirmMessage}
          buttons={[
            {
              label: "Okay",
              onClick: () => {
                setShowConfirm(false);
                if (confirmMessage[0] === "Registration successful!") {
                  navigate("/login");
                }
              },
              variant: "primary",
            },
          ]}
        />
      )}
    </div>
  );
};

export default Signup;
