import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/uploadMiddleware.js";
import { rateLimit } from "../middleware/rateLimitMiddleware.js";
import { suggestReports } from "../controllers/suggestController.js";
import {
  createReport,
  getReports,
  getPriorities,
  getTypes,
  updateReport,
  cancelReport,
  getReportById,
  getStatuses,
  getDistricts,
  getTopTypes,
  getTopReports,
  retryReportAI,
} from "../controllers/reportController.js";
import {
  getRelatedReports,
  searchReports,
} from "../controllers/similarController.js";

import {
  supportReport,
  stopSupportingReport,
  updateSupport,
} from "../controllers/supportController.js";

const router = express.Router();

router.post("/", protect, upload.array("photos", 5), createReport);
// Each call may cost a Gemini request: limit per user.
router.post(
  "/suggest",
  protect,
  rateLimit({ windowMs: 60_000, max: 10 }),
  suggestReports,
);
router.get("/priorities", getPriorities);
router.get("/types", getTypes);
router.get("/statuses", getStatuses);
router.get("/districts", getDistricts);
router.get("/top-types", getTopTypes);
router.get("/top", protect, getTopReports);
router.get("/search", protect, searchReports);
router.get("/:id/related", protect, getRelatedReports);
router.post("/:id/retry-ai", protect, retryReportAI);
router.post("/:id/support", protect, supportReport);
router.put("/:id/support", protect, updateSupport);
router.delete("/:id/support", protect, stopSupportingReport);
router.get("/", protect, getReports);
router.get("/:id", protect, getReportById);
router.put("/:id", protect, updateReport);
router.patch("/:id/cancel", protect, cancelReport);

export default router;
