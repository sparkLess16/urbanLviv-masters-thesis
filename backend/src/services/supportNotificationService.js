import Comment from "../models/Comment.js";
import Notification from "../models/Notification.js";
import {
  SUPPORTER_NOTIFICATION_TITLE,
  getSupporterNotificationText,
} from "../utils/notificationText.js";

// Tells everyone who supports the report that its status changed. The author
// (who has their own notification) and the person who made the change are left
// out. Never throws: the status change itself must not fail because of this.
export const notifySupporters = async (report, newStatus, exceptUserId) => {
  try {
    const content = getSupporterNotificationText(newStatus, report.title);
    if (!content) return 0;

    const supporterIds = await Comment.distinct("created_by", {
      report_id: report._id,
      kind: "support",
    });
    const skip = new Set(
      [report.created_by, exceptUserId].filter(Boolean).map(String),
    );
    const recipients = supporterIds.filter((id) => !skip.has(String(id)));
    if (recipients.length === 0) return 0;

    await Notification.insertMany(
      recipients.map((userId) => ({
        user_id: userId,
        notification_title: SUPPORTER_NOTIFICATION_TITLE,
        notification_content: content,
      })),
    );
    return recipients.length;
  } catch (error) {
    console.error("Notifying supporters failed:", error.message);
    return 0;
  }
};
