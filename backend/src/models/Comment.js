import mongoose from "mongoose";

// A comment is either plain text (kind "comment", the default) or a person's
// support for the report (kind "support"). A support may carry no text, a point
// where the person saw the problem, and where the support was given.
const commentSchema = new mongoose.Schema(
  {
    report_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Report",
      required: true,
    },
    kind: {
      type: String,
      enum: ["comment", "support"],
      default: "comment",
    },
    comment_content: {
      type: String,
      required: function requiredForComments() {
        return this.kind !== "support";
      },
      trim: true,
    },
    // Only for kind "support".
    geo: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number] },
    },
    via: {
      type: String,
      enum: ["hint", "submit_dialog"],
    },
    score: { type: Number, min: 0, max: 1 },
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
    // Indexes are created explicitly with `npm run index:comments`, not on
    // every server start.
    autoIndex: false,
  },
);

// One support per person per report. Partial: ordinary comments are not limited.
commentSchema.index(
  { report_id: 1, created_by: 1 },
  { unique: true, partialFilterExpression: { kind: "support" } },
);

export default mongoose.model("Comment", commentSchema);
