import Report from "../models/Report.js";
import User from "../models/User.js";
import Comment from "../models/Comment.js";
import Notification from "../models/Notification.js";
import { notifySupporters } from "../services/supportNotificationService.js";
import { syncClusterStatusSafely } from "../services/clusteringService.js";

const getNotificationText = (status, title) => {
  switch (status) {
    case "new":
      return `Your report "${title}" was successfully submitted and is awaiting review.`;

    case "in_progress":
      return `Your report "${title}" is currently being reviewed by the administration.`;

    case "resolved":
      return `Good news — your report "${title}" has been resolved. Please check the official response for more details.`;

    case "rejected":
      return `Your report "${title}" was reviewed and rejected. Please check the official response for more details.`;

    case "cancelled":
      return `Your report "${title}" was cancelled.`;

    default:
      return `The status of your report "${title}" has been updated.`;
  }
};

export const getDashboard = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();

    const totalReports = await Report.countDocuments();

    const inProgressReports = await Report.countDocuments({
      status_id: "in_progress",
    });

    res.json({
      totalUsers,
      totalReports,
      inProgressReports,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const getAllReports = async (req, res) => {
  try {
    const reports = await Report.find()
      .sort({ created_dt: -1 })
      .populate("created_by", "firstName lastName email");

    res.json(reports);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const updateReportStatus = async (req, res) => {
  try {
    const { status_id, reason } = req.body;

    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        message: "Report not found",
      });
    }

    const previousStatus = report.status_id;
    report.status_id = status_id;
    await report.save();
    await syncClusterStatusSafely(report);

    await Notification.create({
      user_id: report.created_by,
      notification_title: "Report status updated",
      notification_content: getNotificationText(status_id, report.title),
      is_read: false,
    });

    // People who support the report hear about a real change of status too.
    if (previousStatus !== status_id) {
      await notifySupporters(report, status_id, req.user._id);
    }

    if (
      (status_id === "resolved" || status_id === "rejected") &&
      reason?.trim()
    ) {
      await Comment.create({
        report_id: report._id,
        created_by: req.user._id,
        comment_content: reason.trim(),
      });
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const updateReportPriority = async (req, res) => {
  try {
    const { priority_id } = req.body;

    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        message: "Report not found",
      });
    }

    report.priority_id = priority_id;

    await report.save();

    res.json(report);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
