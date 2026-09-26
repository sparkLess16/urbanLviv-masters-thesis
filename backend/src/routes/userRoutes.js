import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { updateCurrentUser } from "../controllers/userController.js";
import { upload } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.put("/me", protect, upload.single("avatar"), updateCurrentUser);

export default router;
