import express from "express";

import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";

import {
  getDashboard,
  getAllReports,
  updateReportStatus,
  updateReportPriority,
} from "../controllers/adminController.js";

const router = express.Router();

router.get("/dashboard", protect, adminOnly, getDashboard);

router.get("/reports", protect, adminOnly, getAllReports);

router.patch("/reports/:id/status", protect, adminOnly, updateReportStatus);

router.patch("/reports/:id/priority", protect, adminOnly, updateReportPriority);

export default router;
