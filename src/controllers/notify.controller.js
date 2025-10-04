const { sendToTokens } = require("../utils/fcm"); // adjust path if needed
const Notification = require("../models/Notification");
const User = require("../models/User");

exports.sendNotification = async (req, res) => {
  const userId = req.user?._id || req.user?.id;
  const { title, body, data } = req.body;
  if (!userId || !title || !body)
    return res
      .status(400)
      .json({ error: "userId (auth), title, body required" });

  const user = await User.findById(userId).lean();
  const tokens = user?.fcmTokens || [];
  if (!tokens.length)
    return res.status(404).json({ error: "No tokens for this user" });

  const notification = await Notification.create({
    userId,
    title,
    body,
    data: data || {},
  });

  const result = await sendToTokens(tokens, { title, body, data });
  const invalids = [];
  result.responses?.forEach((r, i) => {
    if (!r.success) {
      const code = r.error?.code;
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        invalids.push(tokens[i]);
      }
    }
  });
  if (invalids.length) {
    await User.updateOne(
      { _id: userId },
      { $pull: { fcmTokens: { $in: invalids } } }
    );
  }

  res.json({
    success: true,
    notificationId: notification._id,
    sent: result.successCount,
    failed: result.failureCount,
    pruned: invalids.length,
  });
};

exports.getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50); // latest 50
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const { userId } = req.params;

    // count only, no need to fetch docs
    const unread = await Notification.countDocuments({ userId, read: false });

    res.json({ unread });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByIdAndUpdate(
      id,
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Mark all notifications of a user as read
exports.markAllAsRead = async (req, res) => {
  try {
    const { userId } = req.params;

    await Notification.updateMany(
      { userId, read: false },
      { $set: { read: true } }
    );

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.registerToken = async (req, res) => {
  const { token } = req.body;
  const userId = req.user._id; // from auth middleware/JWT

  if (!token) return res.status(400).json({ error: "Missing token" });

  const user = await User.findByIdAndUpdate(
    userId,
    { $addToSet: { fcmTokens: token } }, // de-dupe
    { new: true }
  );

  // (Optional) cap tokens
  if (user.fcmTokens.length > 5) {
    user.fcmTokens = user.fcmTokens.slice(-5);
    await user.save();
  }
  res.json({ success: true });
};
