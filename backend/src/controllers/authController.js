import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import crypto from "crypto";
import { sendConfirmationEmail } from "../services/emailService.js";
import { verifyGoogleCredential } from "../services/googleAuthService.js";
import { decideGoogleSignIn } from "../utils/googleAuthRules.js";

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

const toAuthUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar_url: user.avatar_url,
  auth_provider: user.auth_provider,
});

export const verifyAccount = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ message: "Verification token is missing" });
    }

    const user = await User.findOne({
      verificationToken: token,
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid verification token" });
    }

    user.isVerified = true;
    user.verificationToken = undefined;

    await user.save();

    res.status(200).json({
      message: "Account verified successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const registerUser = async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: "Please fill in all fields" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    const verificationToken = crypto.randomBytes(32).toString("hex");

    user.verificationToken = verificationToken;
    user.isVerified = false;
    await user.save();

    const confirmUrl = `http://localhost:3000/verify-account?token=${verificationToken}`;

    await sendConfirmationEmail(user.email, user.name, confirmUrl);

    res.status(201).json({
      message: "User registered successfully. Please verify your email.",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Please enter email and password" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.password) {
      return res.status(401).json({
        message:
          "This account uses Google sign-in. Please use the Google button.",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in.",
      });
    }

    res.json({
      token: generateToken(user._id),
      user: toAuthUser(user),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential || typeof credential !== "string") {
      return res.status(400).json({ message: "Google credential is missing" });
    }

    let payload;
    try {
      payload = await verifyGoogleCredential(credential);
    } catch (error) {
      if (error.message === "Google sign-in is not configured") {
        return res.status(500).json({ message: error.message });
      }
      return res.status(401).json({ message: "Invalid Google token" });
    }

    const email = payload?.email?.toLowerCase();
    const [userByGoogleId, userByEmail] = await Promise.all([
      User.findOne({ google_id: payload?.sub }),
      email ? User.findOne({ email }) : null,
    ]);

    const decision = decideGoogleSignIn({
      payload,
      userByGoogleId,
      userByEmail,
    });

    if (decision.action === "reject") {
      return res.status(401).json({ message: decision.message });
    }

    let user = decision.user;

    if (decision.action === "create") {
      user = await User.create({
        name:
          payload.name ||
          [payload.given_name, payload.family_name].filter(Boolean).join(" ") ||
          email.split("@")[0],
        email,
        auth_provider: "google",
        google_id: payload.sub,
        isVerified: true,
        avatar_url: payload.picture || "",
      });
    } else if (decision.action === "link") {
      user.google_id = payload.sub;
      user.isVerified = true;
      user.verificationToken = undefined;
      if (!user.avatar_url && payload.picture) {
        user.avatar_url = payload.picture;
      }
      if (decision.resetPassword) {
        user.password = undefined;
        user.auth_provider = "google";
      }
      await user.save();
    }

    res.json({ token: generateToken(user._id), user: toAuthUser(user) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMe = async (req, res) => {
  res.json(req.user);
};
