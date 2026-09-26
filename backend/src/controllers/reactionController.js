import Reaction from "../models/Reaction.js";
import Report from "../models/Report.js";

export const toggleReaction = async (req, res) => {
  try {
    const { type } = req.body;
    const { reportId } = req.params;

    if (!["like", "dislike"].includes(type)) {
      return res.status(400).json({ message: "Invalid reaction type" });
    }

    const report = await Report.findById(reportId);

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    const existingReaction = await Reaction.findOne({
      report_id: reportId,
      created_by: req.user._id,
    });

    if (!existingReaction) {
      await Reaction.create({
        report_id: reportId,
        created_by: req.user._id,
        type,
      });
    } else if (existingReaction.type === type) {
      await existingReaction.deleteOne();
    } else {
      existingReaction.type = type;
      await existingReaction.save();
    }

    const totalLikes = await Reaction.countDocuments({
      report_id: reportId,
      type: "like",
    });

    const totalDislikes = await Reaction.countDocuments({
      report_id: reportId,
      type: "dislike",
    });

    const currentUserReaction = await Reaction.findOne({
      report_id: reportId,
      created_by: req.user._id,
    });

    report.total_likes = totalLikes;
    report.total_dislikes = totalDislikes;
    await report.save();

    res.json({
      total_likes: totalLikes,
      total_dislikes: totalDislikes,
      user_reaction: currentUserReaction ? currentUserReaction.type : null,
      is_user_liked: currentUserReaction?.type === "like",
      is_user_disliked: currentUserReaction?.type === "dislike",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
