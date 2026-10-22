// Text of the notification that people who support a report get when its
// status changes. Statuses without a meaning for them ("new") give no text.
export const getSupporterNotificationText = (status, title) => {
  switch (status) {
    case "in_progress":
      return `The report you support, "${title}", is now being reviewed by the administration.`;
    case "resolved":
      return `Good news — the report you support, "${title}", has been resolved.`;
    case "rejected":
      return `The report you support, "${title}", was reviewed and rejected.`;
    case "cancelled":
      return `The report you support, "${title}", was cancelled.`;
    case "new":
      return null;
    default:
      return `The status of the report you support, "${title}", has been updated.`;
  }
};

export const SUPPORTER_NOTIFICATION_TITLE =
  "Report you support: status updated";
