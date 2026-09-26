import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getNotifications,
  getNotViewedCount,
  markNotificationsAsViewed,
} from "../controllers/notificationController.js";

const router = express.Router();

router.get("/", protect, getNotifications);
router.get("/not-viewed", protect, getNotViewedCount);
router.patch("/mark-viewed", protect, markNotificationsAsViewed);

export default router;
