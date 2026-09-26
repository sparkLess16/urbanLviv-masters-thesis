import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { toggleReaction } from "../controllers/reactionController.js";

const router = express.Router();

router.post("/report/:reportId", protect, toggleReaction);

export default router;
