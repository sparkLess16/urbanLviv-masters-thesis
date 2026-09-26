import Notification from "../models/Notification.js";

export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      user_id: req.user._id,
    }).sort({ created_dt: -1 });

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getNotViewedCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      user_id: req.user._id,
      is_viewed: false,
    });

    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const markNotificationsAsViewed = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        user_id: req.user._id,
        is_viewed: false,
      },
      {
        is_viewed: true,
      },
    );

    res.json({ message: "Notifications marked as viewed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
