import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getReportComments,
  createComment,
  updateComment,
  deleteComment,
} from "../controllers/commentController.js";

const router = express.Router();

router.get("/report/:reportId", protect, getReportComments);
router.post("/report/:reportId", protect, createComment);
router.put("/:commentId", protect, updateComment);
router.delete("/:commentId", protect, deleteComment);

export default router;
