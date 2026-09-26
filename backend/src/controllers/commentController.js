import Comment from "../models/Comment.js";

export const getReportComments = async (req, res) => {
  try {
    const comments = await Comment.find({ report_id: req.params.reportId })
      .populate("created_by", "firstName lastName role")
      .sort({ created_dt: 1 });

    const formattedComments = comments.map((comment) => {
      const user = comment.created_by;

      return {
        id: comment._id,
        comment_content: comment.comment_content,
        created_dt: comment.created_dt,
        created_by_id: user?._id || null,
        created_by: user
          ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
          : "Unknown User",
        created_by_role_name: user?.role === "admin" ? "Administrator" : "User",
      };
    });

    res.json(formattedComments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createComment = async (req, res) => {
  try {
    const { comment_content } = req.body;

    if (!comment_content || !comment_content.trim()) {
      return res.status(400).json({ message: "Comment is required" });
    }

    const comment = await Comment.create({
      report_id: req.params.reportId,
      comment_content,
      created_by: req.user._id,
    });

    await comment.populate("created_by", "firstName lastName role");

    res.status(201).json({
      id: comment._id,
      comment_content: comment.comment_content,
      created_dt: comment.created_dt,
      created_by_id: comment.created_by._id,
      created_by: `${comment.created_by.firstName} ${comment.created_by.lastName}`,
      created_by_role_name:
        comment.created_by.role === "admin" ? "Administrator" : "User",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateComment = async (req, res) => {
  try {
    const { comment_content } = req.body;

    if (!comment_content || !comment_content.trim()) {
      return res.status(400).json({ message: "Comment is required" });
    }

    const comment = await Comment.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (comment.created_by.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not allowed to edit this comment" });
    }

    comment.comment_content = comment_content;
    await comment.save();

    res.json({
      id: comment._id,
      comment_content: comment.comment_content,
      created_dt: comment.created_dt,
      modified_dt: comment.modified_dt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (comment.created_by.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not allowed to delete this comment" });
    }

    await comment.deleteOne();

    res.json({ message: "Comment deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
