import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { rateLimit } from "../middleware/rateLimitMiddleware.js";
import {
  forwardGeocode,
  reverseGeocode,
} from "../controllers/geoController.js";

const router = express.Router();

// One limiter for both routes: they share the upstream Nominatim quota.
const geoLimiter = rateLimit({ windowMs: 60_000, max: 30 });

router.get("/reverse", protect, geoLimiter, reverseGeocode);
router.get("/forward", protect, geoLimiter, forwardGeocode);

export default router;
