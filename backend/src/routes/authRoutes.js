import express from "express";
import {
  registerUser,
  loginUser,
  getMe,
  verifyAccount,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", protect, getMe);
router.get("/verify-account", verifyAccount);

export default router;
