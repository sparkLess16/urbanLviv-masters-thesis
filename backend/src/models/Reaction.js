import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema(
  {
    report_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Report",
      required: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["like", "dislike"],
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

export default mongoose.model("Reaction", reactionSchema);
