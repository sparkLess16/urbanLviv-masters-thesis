import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getClusterById,
  getClusters,
} from "../controllers/clusterController.js";

const router = express.Router();

// Any signed-in user can view clusters (decision Q9).
router.get("/", protect, getClusters);
router.get("/:id", protect, getClusterById);

export default router;
