import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    district_id: {
      type: String,
      required: true,
    },

    type_id: {
      type: String,
      enum: [
        "roads",
        "lighting",
        "garbage",
        "transport",
        "parks",
        "buildings",
        "other",
      ],
      required: true,
    },

    status_id: {
      type: String,
      enum: ["new", "in_progress", "resolved", "rejected", "cancelled"],
      default: "new",
    },

    priority_id: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
    },

    processing_status_id: {
      type: String,
      enum: ["not_processed", "processing", "processed", "failed"],
      default: "not_processed",
    },
    suggest_priority_id: {
      type: String,
      default: null,
    },

    official_summary: {
      type: String,
      default: "",
    },

    recommendations: {
      type: [String],
      default: [],
    },

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    modified_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    attachment_urls: [
      {
        Content: {
          type: String,
        },
      },
    ],

    total_likes: {
      type: Number,
      default: 0,
    },

    total_dislikes: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: {
      createdAt: "created_dt",
      updatedAt: "modified_dt",
    },
  },
);

export default mongoose.model("Report", reportSchema);
