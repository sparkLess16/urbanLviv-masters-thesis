import mongoose from "mongoose";
import Comment from "../models/Comment.js";
import { buildSupportInfo } from "../utils/supportRules.js";

// Support counts and "did I support it" for many reports at once: two queries
// for the whole list, not two per report.
// Returns Map(String(reportId) -> { count, mine }).
export const getSupportInfo = async (reportIds, userId = null) => {
  const ids = reportIds.map((id) => new mongoose.Types.ObjectId(String(id)));
  if (ids.length === 0) return new Map();

  const [counts, mineDocs] = await Promise.all([
    Comment.aggregate([
      { $match: { report_id: { $in: ids }, kind: "support" } },
      { $group: { _id: "$report_id", count: { $sum: 1 } } },
    ]),
    userId
      ? Comment.find({
          report_id: { $in: ids },
          kind: "support",
          created_by: userId,
        })
          .select("report_id")
          .lean()
      : [],
  ]);

  return buildSupportInfo(ids, counts, mineDocs);
};

export const countSupports = (reportId) =>
  Comment.countDocuments({ report_id: reportId, kind: "support" });
