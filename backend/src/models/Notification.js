import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    notification_title: {
      type: String,
      required: true,
    },
    notification_content: {
      type: String,
      required: true,
    },
    is_viewed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: {
      createdAt: "created_dt",
      updatedAt: "modified_dt",
    },
  },
);

export default mongoose.model("Notification", notificationSchema);
