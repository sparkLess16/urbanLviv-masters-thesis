import mongoose from "mongoose";
import Comment from "../models/Comment.js";
import Report from "../models/Report.js";
import { countSupports } from "../services/supportService.js";
import {
  checkSupportAllowed,
  parseSupportInput,
} from "../utils/supportRules.js";

const DUPLICATE_KEY_ERROR = 11000;

// POST /api/reports/:id/support { comment?, lat?, lng?, via?, score? }
export const supportReport = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid report id" });
    }
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    const denied = checkSupportAllowed(report, req.user._id);
    if (denied)
      return res.status(denied.status).json({ message: denied.message });

    const { value, error } = parseSupportInput(req.body, report);
    if (error) return res.status(error.status).json({ message: error.message });

    const alreadySupported = await Comment.exists({
      report_id: report._id,
      created_by: req.user._id,
      kind: "support",
    });
    if (alreadySupported) {
      return res
        .status(409)
        .json({ message: "You already support this report" });
    }

    const support = await Comment.create({
      report_id: report._id,
      kind: "support",
      comment_content: value.comment,
      geo: value.geo,
      via: value.via,
      score: value.score,
      created_by: req.user._id,
    });

    res.status(201).json({
      id: support._id,
      report_id: report._id,
      distance_m: value.distance_m ?? null,
      supported_by_count: await countSupports(report._id),
      supported_by_me: true,
    });
  } catch (error) {
    // Two simultaneous requests: the unique index rejects the second one.
    if (error.code === DUPLICATE_KEY_ERROR) {
      return res
        .status(409)
        .json({ message: "You already support this report" });
    }
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/reports/:id/support
export const stopSupportingReport = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid report id" });
    }
    const removed = await Comment.findOneAndDelete({
      report_id: req.params.id,
      created_by: req.user._id,
      kind: "support",
    });
    if (!removed) {
      return res
        .status(404)
        .json({ message: "You do not support this report" });
    }

    res.json({
      supported_by_count: await countSupports(req.params.id),
      supported_by_me: false,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/reports/:id/support { comment?, lat?, lng? }
// Replaces the text and the marked point of the user's own support: without
// lat/lng the point is removed. Where and how it was given stays as it was.
export const updateSupport = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid report id" });
    }
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    const support = await Comment.findOne({
      report_id: report._id,
      created_by: req.user._id,
      kind: "support",
    });
    if (!support) {
      return res
        .status(404)
        .json({ message: "You do not support this report" });
    }

    const { value, error } = parseSupportInput(req.body, report);
    if (error) return res.status(error.status).json({ message: error.message });

    support.comment_content = value.comment;
    support.geo = value.geo;
    await support.save();

    res.json({
      id: support._id,
      report_id: report._id,
      distance_m: value.distance_m ?? null,
      supported_by_count: await countSupports(report._id),
      supported_by_me: true,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
