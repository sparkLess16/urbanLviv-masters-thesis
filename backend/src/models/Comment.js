import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    report_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Report",
      required: true,
    },
    comment_content: {
      type: String,
      required: true,
      trim: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: {
      createdAt: "created_dt",
      updatedAt: "modified_dt",
    },
  },
);

export default mongoose.model("Comment", commentSchema);
