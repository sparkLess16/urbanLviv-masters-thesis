import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      trim: true,
      default: "",
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Only local accounts have a password; Google accounts sign in with a token.
    password: {
      type: String,
      required() {
        return this.auth_provider === "local";
      },
    },

    auth_provider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    google_id: {
      type: String,
      index: { unique: true, sparse: true },
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    avatar_url: {
      type: String,
      default: "",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("User", userSchema);
