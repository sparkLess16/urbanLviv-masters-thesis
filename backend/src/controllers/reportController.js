import Report from "../models/Report.js";
import cloudinary from "../config/cloudinary.js";
import Reaction from "../models/Reaction.js";
import Comment from "../models/Comment.js";
import { analyzeReportWithAI } from "../services/geminiService.js";
import { embedReport } from "../services/embeddingService.js";
import { buildGeoPoint, geoToLatLng } from "../utils/geo.js";
import { DISTRICTS, getDistrictLabel } from "../utils/districts.js";
import { getSupportInfo } from "../services/supportService.js";
import { notifySupporters } from "../services/supportNotificationService.js";
import { computeTopScore } from "../utils/topScore.js";

const NOT_SUPPORT = { $ne: "support" };

export const createReport = async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      district_id,
      type_id,
      priority_id,
      lat,
      lng,
    } = req.body;

    if (
      !title ||
      !description ||
      !location ||
      !type_id ||
      !priority_id ||
      !district_id
    ) {
      return res.status(400).json({
        message: "Please fill in all required fields",
      });
    }

    const { geo, error: geoError } = buildGeoPoint(lat, lng);
    if (geoError) {
      return res.status(400).json({ message: geoError });
    }

    const uploadedPhotos = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.buffer);

        uploadedPhotos.push({
          Content: result.secure_url,
          public_id: result.public_id,
        });
      }
    }

    // Null when Gemini is down: the report is still saved, backfill adds the vector.
    const embeddingFields = await embedReport({ title, description });

    const report = await Report.create({
      title,
      description,
      location,
      district_id,
      geo,
      type_id,
      priority_id,
      ...embeddingFields,
      attachment_urls: uploadedPhotos,
      created_by: req.user._id,
      modified_by: req.user._id,
    });

    report.processing_status_id = "processing";
    await report.save();

    res.status(201).json({
      message: "Report created successfully",
      report,
    });

    analyzeReportWithAI(report)
      .then(async (aiData) => {
        report.suggest_priority_id = aiData.suggest_priority_id;
        report.official_summary = aiData.official_summary;
        report.recommendations = aiData.recommendations;
        report.processing_status_id = "processed";
        await report.save();
      })
      .catch(async (error) => {
        console.error("Gemini AI error:", error);
        report.processing_status_id = "failed";
        await report.save();
      });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
export const getPriorities = (req, res) => {
  res.json([
    { id: "low", name: "Low" },
    { id: "medium", name: "Medium" },
    { id: "high", name: "High" },
    { id: "critical", name: "Critical" },
  ]);
};
export const getTypes = (req, res) => {
  res.json([
    { id: "roads", name: "Roads" },
    { id: "lighting", name: "Lighting" },
    { id: "garbage", name: "Garbage" },
    { id: "transport", name: "Transport" },
    { id: "parks", name: "Parks" },
    { id: "buildings", name: "Buildings" },
    { id: "other", name: "Other" },
  ]);
};
export const getStatuses = (req, res) => {
  res.json([
    { id: "new", name: "New", color: getStatusColor("new") },
    {
      id: "in_progress",
      name: "In Progress",
      color: getStatusColor("in_progress"),
    },
    { id: "resolved", name: "Resolved", color: getStatusColor("resolved") },
    { id: "rejected", name: "Rejected", color: getStatusColor("rejected") },
    { id: "cancelled", name: "Cancelled", color: getStatusColor("cancelled") },
  ]);
};
const getStatusColor = (status) => {
  switch (status) {
    case "new":
      return "#FFFAFD";

    case "in_progress":
      return "#FFF7F0";

    case "resolved":
      return "#EEFFEB";

    case "rejected":
      return "#FFEBEB";

    case "cancelled":
      return "#f0f0f0";

    default:
      return "#999999";
  }
};
const getStatusName = (status) => {
  switch (status) {
    case "new":
      return "New";

    case "in_progress":
      return "In Progress";

    case "resolved":
      return "Resolved";

    case "rejected":
      return "Rejected";

    case "cancelled":
      return "Cancelled";

    default:
      return status;
  }
};
const getPriorityName = (priority) => {
  switch (priority) {
    case "low":
      return "Low";

    case "medium":
      return "Medium";

    case "high":
      return "High";

    case "critical":
      return "Critical";

    default:
      return priority;
  }
};

const getTypeName = (type) => {
  switch (type) {
    case "roads":
      return "Roads";

    case "lighting":
      return "Lighting";

    case "garbage":
      return "Garbage";

    case "transport":
      return "Transport";

    case "parks":
      return "Parks";

    case "buildings":
      return "Buildings";

    case "other":
      return "Other";

    default:
      return type;
  }
};
export const getReports = async (req, res) => {
  try {
    const topReportIds = await getTopReportIds();
    const reports = await Report.find()
      .sort({ created_dt: -1 })
      .populate("created_by", "firstName lastName role");
    const supportInfo = await getSupportInfo(
      reports.map((report) => report._id),
      req.user._id,
    );

    const formattedReports = await Promise.all(
      reports.map(async (report) => {
        const support = supportInfo.get(String(report._id));
        const userReaction = await Reaction.findOne({
          report_id: report._id,
          created_by: req.user._id,
        });

        const comments = await Comment.find({
          report_id: report._id,
          kind: NOT_SUPPORT,
        })
          .populate("created_by", "firstName lastName role")
          .sort({ created_dt: 1 });

        return {
          reportId: report._id,
          report_id: report._id,
          title: report.title,
          description: report.description,
          location: report.location,
          coordinates: geoToLatLng(report.geo),

          district_id: report.district_id,
          district_name: getDistrictLabel(report.district_id),

          type_id: report.type_id,
          type_name: getTypeName(report.type_id),

          priority_id: report.priority_id,
          priority_name: getPriorityName(report.priority_id),

          status_id: report.status_id,
          status_name: getStatusName(report.status_id),
          status_color: getStatusColor(report.status_id),

          attachment_urls: report.attachment_urls || [],

          total_likes: report.total_likes || 0,
          total_dislikes: report.total_dislikes || 0,

          user_reaction: userReaction ? userReaction.type : null,
          is_user_liked: userReaction?.type === "like",
          is_user_disliked: userReaction?.type === "dislike",

          is_top_report: topReportIds.includes(report._id.toString()),

          supported_by_count: support?.count ?? 0,
          supported_by_me: support?.mine ?? false,

          created_by: report.created_by,
          created_dt: report.created_dt,
          modified_dt: report.modified_dt,

          comments: comments.map((comment) => ({
            id: comment._id,
            comment_content: comment.comment_content,
            created_dt: comment.created_dt,
            created_by_id: comment.created_by?._id,
            created_by: comment.created_by
              ? `${comment.created_by.firstName} ${comment.created_by.lastName}`
              : "Unknown User",
            created_by_role_name:
              comment.created_by?.role === "admin" ? "Administrator" : "User",
          })),
        };
      }),
    );
    res.json(formattedReports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id).populate(
      "created_by",
      "firstName lastName role",
    );

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    const userReaction = await Reaction.findOne({
      report_id: report._id,
      created_by: req.user._id,
    });

    const support = (await getSupportInfo([report._id], req.user._id)).get(
      String(report._id),
    );

    res.json({
      reportId: report._id,
      report_id: report._id,

      title: report.title,
      description: report.description,
      location: report.location,
      coordinates: geoToLatLng(report.geo),
      district_id: report.district_id,
      district_name: getDistrictLabel(report.district_id),

      type_id: report.type_id,
      type_name: getTypeName(report.type_id),

      priority_id: report.priority_id,
      priority_name: getPriorityName(report.priority_id),

      status_id: report.status_id,
      status_name: getStatusName(report.status_id),
      status_color: getStatusColor(report.status_id),

      processing_status_id: report.processing_status_id,

      suggest_priority_id: report.suggest_priority_id,
      official_summary: report.official_summary,
      recommendations: report.recommendations,

      attachment_urls: report.attachment_urls || [],

      total_likes: report.total_likes || 0,
      total_dislikes: report.total_dislikes || 0,

      created_by: report.created_by,
      created_dt: report.created_dt,
      modified_dt: report.modified_dt,

      comments: [],
      supported_by_count: support?.count ?? 0,
      supported_by_me: support?.mine ?? false,
      user_reaction: userReaction ? userReaction.type : null,
      is_user_liked: userReaction?.type === "like",
      is_user_disliked: userReaction?.type === "dislike",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const getDistricts = (req, res) => {
  res.json(DISTRICTS.map(({ id, name }) => ({ id, name })));
};

const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "urbanlviv/reports" },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );

    stream.end(fileBuffer);
  });
};

export const updateReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    const isOwner = report.created_by.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res
        .status(403)
        .json({ message: "Not allowed to edit this report" });
    }

    const {
      title,
      description,
      location,
      district_id,
      priority_id,
      type_id,
      lat,
      lng,
    } = req.body;

    // Coordinates are optional on update; if sent, they must be valid.
    if (lat !== undefined || lng !== undefined) {
      const { geo, error: geoError } = buildGeoPoint(lat, lng);
      if (geoError) {
        return res.status(400).json({ message: geoError });
      }
      report.geo = geo;
    }

    // An admin who is not the author may only correct the coordinates;
    // other fields and the AI analysis stay untouched.
    if (!isOwner) {
      report.modified_by = req.user._id;
      const savedReport = await report.save();
      return res.json({
        message: "Report location updated successfully",
        report: savedReport,
      });
    }

    const textChanged =
      (title && title !== report.title) ||
      (description && description !== report.description);

    report.title = title || report.title;
    report.description = description || report.description;

    if (textChanged) {
      const embeddingFields = await embedReport(report);
      // On failure drop the stale vector so backfill recomputes it.
      Object.assign(
        report,
        embeddingFields ?? { embedding: undefined, embedding_model: undefined },
      );
    }

    report.location = location || report.location;
    report.district_id = district_id || report.district_id;
    report.priority_id = priority_id || report.priority_id;
    report.type_id = type_id || report.type_id;
    report.modified_by = req.user._id;

    report.processing_status_id = "processing";

    const updatedReport = await report.save();

    res.json({
      message: "Report updated successfully",
      report: updatedReport,
    });

    analyzeReportWithAI(updatedReport)
      .then(async (aiData) => {
        updatedReport.suggest_priority_id = aiData.suggest_priority_id;
        updatedReport.official_summary = aiData.official_summary;
        updatedReport.recommendations = aiData.recommendations;
        updatedReport.processing_status_id = "processed";
        await updatedReport.save();
      })
      .catch(async (error) => {
        console.error("Gemini AI error:", error);

        updatedReport.processing_status_id = "failed";

        await updatedReport.save();
      });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const cancelReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    if (report.created_by.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not allowed to cancel this report" });
    }

    report.status_id = "cancelled";
    report.modified_by = req.user._id;

    await report.save();
    await notifySupporters(report, "cancelled", req.user._id);

    res.json({ message: "Report cancelled successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTopTypes = async (req, res) => {
  try {
    const typeStats = await Report.aggregate([
      {
        $group: {
          _id: "$type_id",
          count: { $sum: 1 },
        },
      },
    ]);

    const countsByType = typeStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const types = [
      { id: "roads", name: "Roads", emoji: "🛣️" },
      { id: "lighting", name: "Lighting", emoji: "💡" },
      { id: "garbage", name: "Garbage", emoji: "🗑️" },
      { id: "transport", name: "Transport", emoji: "🚌" },
      { id: "parks", name: "Parks", emoji: "🌱" },
      { id: "buildings", name: "Buildings", emoji: "🏢" },
      { id: "other", name: "Other", emoji: "💬" },
    ];

    const result = types.map((type) => ({
      ...type,
      count: countsByType[type.id] || 0,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTopReports = async (req, res) => {
  try {
    const reports = await Report.find({
      status_id: {
        $nin: ["resolved", "cancelled"],
      },
    })
      .populate("created_by", "firstName lastName role")
      .sort({ created_dt: -1 });

    const supportInfo = await getSupportInfo(
      reports.map((report) => report._id),
      req.user._id,
    );

    const formattedReports = await Promise.all(
      reports.map(async (report) => {
        const commentsCount = await Comment.countDocuments({
          report_id: report._id,
          kind: NOT_SUPPORT,
        });

        const likesCount = await Reaction.countDocuments({
          report_id: report._id,
          type: "like",
        });

        const dislikesCount = await Reaction.countDocuments({
          report_id: report._id,
          type: "dislike",
        });

        const userReaction = await Reaction.findOne({
          report_id: report._id,
          created_by: req.user._id,
        });

        const topScore = computeTopScore({
          priorityId: report.priority_id,
          likes: likesCount,
          dislikes: dislikesCount,
          comments: commentsCount,
          supports: supportInfo.get(String(report._id))?.count ?? 0,
        });

        return {
          reportId: report._id,
          report_id: report._id,
          title: report.title,
          description: report.description,
          location: report.location,
          district_id: report.district_id,
          district_name: getDistrictLabel(report.district_id),
          type_id: report.type_id,
          type_name: getTypeName(report.type_id),
          priority_id: report.priority_id,
          priority_name: getPriorityName(report.priority_id),
          status_id: report.status_id,
          status_name: getStatusName(report.status_id),
          status_color: getStatusColor(report.status_id),
          attachment_urls: report.attachment_urls || [],
          total_likes: likesCount,
          total_dislikes: dislikesCount,
          comments_count: commentsCount,
          supported_by_count: supportInfo.get(String(report._id))?.count ?? 0,
          supported_by_me: supportInfo.get(String(report._id))?.mine ?? false,
          topScore,
          is_top_report: true,
          user_reaction: userReaction ? userReaction.type : null,
          is_user_liked: userReaction?.type === "like",
          is_user_disliked: userReaction?.type === "dislike",
          created_by: report.created_by,
          created_dt: report.created_dt,
          modified_dt: report.modified_dt,
        };
      }),
    );

    const topReports = formattedReports
      .sort((a, b) => b.topScore - a.topScore)
      .slice(0, 5);

    res.json(topReports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getTopReportIds = async () => {
  const reports = await Report.find({
    status_id: {
      $nin: ["resolved", "cancelled", "rejected"],
    },
  });

  const supportInfo = await getSupportInfo(reports.map((report) => report._id));
  const reportsWithScore = await Promise.all(
    reports.map(async (report) => {
      const commentsCount = await Comment.countDocuments({
        report_id: report._id,
        kind: NOT_SUPPORT,
      });

      const likesCount = await Reaction.countDocuments({
        report_id: report._id,
        type: "like",
      });

      const dislikesCount = await Reaction.countDocuments({
        report_id: report._id,
        type: "dislike",
      });

      const topScore = computeTopScore({
        priorityId: report.priority_id,
        likes: likesCount,
        dislikes: dislikesCount,
        comments: commentsCount,
        supports: supportInfo.get(String(report._id))?.count ?? 0,
      });

      return {
        id: report._id.toString(),
        topScore,
      };
    }),
  );

  return reportsWithScore
    .sort((a, b) => b.topScore - a.topScore)
    .slice(0, 5)
    .map((report) => report.id);
};

export const retryReportAI = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    report.processing_status_id = "processing";
    report.processing_error = "";
    await report.save();

    res.json({
      message: "AI processing restarted",
      report,
    });

    analyzeReportWithAI(report)
      .then(async (aiData) => {
        report.suggest_priority_id = aiData.suggest_priority_id;
        report.official_summary = aiData.official_summary;
        report.recommendations = aiData.recommendations;
        report.processing_status_id = "processed";
        report.processing_error = "";
        await report.save();
      })
      .catch(async (error) => {
        console.error("Gemini AI retry error:", error);
        report.processing_status_id = "failed";
        report.processing_error = error.message || "AI processing failed";
        await report.save();
      });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
