const asyncHandler = require("../utils/asyncHandler");
const Notice = require("../models/Notice");
const { T } = require("../utils/tenant");
const { sendToTokens } = require("../utils/fcm");
const User = require("../models/User");

// 🟩 CREATE NOTICE + PUSH NOTIFICATION
exports.create = asyncHandler(async (req, res) => {
  const { title, body, audience, publishAt, expiresAt } = req.body;

  // Validation
  if (!title || !body)
    return res.status(400).json({ message: "Title and body are required." });

  const now = new Date();
  const publishDate = publishAt ? new Date(publishAt) : now;
  const expiryDate = expiresAt ? new Date(expiresAt) : null;

  if (publishDate < now)
    return res
      .status(400)
      .json({ message: "Publish date cannot be in the past." });

  // Create Notice
  const notice = await Notice.create({
    title,
    body,
    audience: audience || ["ALL"],
    publishAt: publishDate,
    expiresAt: expiryDate,
    tenant: req.user.tenant,
    publishedBy: req.user._id,
  });

  // 🎯 Determine target users based on audience
  let userFilter = { tenant: req.tenantId };
  if (audience && !audience.includes("ALL")) {
    userFilter.role = { $in: audience }; // e.g. ["STUDENT", "TEACHER"]
  }

  const users = await User.find(userFilter).select("fcmTokens");
  const tokens = users.flatMap((u) => u.fcmTokens || []);

  // ✅ Send Push Notification
  if (tokens.length > 0) {
    try {
      const result = await sendToTokens(tokens, {
        title,
        body,
        data: {
          type: "NOTICE",
          noticeId: String(notice._id),
          click_action: "FLUTTER_NOTIFICATION_CLICK",
        },
      });
      console.log(
        `[FCM] Notice push: ${result.successCount}/${tokens.length} sent, ${result.failureCount} failed`
      );
    } catch (err) {
      console.error("[FCM] Notice push failed:", err.message);
    }
  }

  res.status(201).json({
    message: "Notice created and push sent successfully.",
    data: notice,
  });
});

// 🟨 LIST NOTICES
exports.list = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const now = new Date();

  let condition = {};
  if (status === "expired") condition = { expiresAt: { $lt: now } };
  else if (status === "all") condition = {};
  else condition = { $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }] };

  const query = (req, condition);
  const notices = await Notice.find(query)
    .populate("publishedBy", "name email role")
    .sort({ publishAt: -1 })
    .limit(100);

  res.status(200).json({
    total: notices.length,
    data: notices,
  });
});
