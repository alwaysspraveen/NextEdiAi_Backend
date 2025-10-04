// controllers/announcementController.js
const User = require("../models/User");
const Announcement = require("../models/Announcement");
const { sendToTokens } = require("../utils/fcm"); // same helper you already use

exports.sendClassAnnouncement = async (req, res) => {
  try {
    const { classId, title, body, data } = req.body;

    if (!classId || !title || !body) {
      return res.status(400).json({ error: "classId, title, body required" });
    }

    // Get all students in class
    const students = await User.find({ classId, role: "STUDENT" }).lean();
    if (!students.length) {
      return res.status(404).json({ error: "No students in this class" });
    }

    // Collect all tokens
    const allTokens = students.flatMap(s => s.fcmTokens || []);
    if (!allTokens.length) {
      return res.status(404).json({ error: "No FCM tokens for students in this class" });
    }

    // Save announcement in DB
    const announcement = await Announcement.create({
      classId,
      title,
      body,
      data: data || {},
      sentTo: students.map(s => s._id),
    });

    // Send notification to all tokens
    const result = await sendToTokens(allTokens, { title, body, data });

    // Track invalid tokens & prune
    const invalids = [];
    result.responses?.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code;
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          invalids.push(allTokens[i]);
        }
      }
    });
    if (invalids.length) {
      await User.updateMany(
        { _id: { $in: students.map(s => s._id) } },
        { $pull: { fcmTokens: { $in: invalids } } }
      );
    }

    res.json({
      success: true,
      announcementId: announcement._id,
      totalStudents: students.length,
      sent: result.successCount,
      failed: result.failureCount,
      pruned: invalids.length,
    });
  } catch (err) {
    console.error("sendClassAnnouncement error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
