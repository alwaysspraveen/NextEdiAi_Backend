const Leave = require("../models/Leave");
const Timetable = require("../models/TimeTable"); // use your main timetable model

// Helper: get all dates between start & end
function getDatesBetween(start, end) {
  const days = [];
  let current = new Date(start);
  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

// Helper: compute Monday weekStart from a given date
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function createLeave(req, res) {
  try {
    let { teacherId, startDate, endDate, reason } = req.body;

    if (!teacherId || !startDate || !endDate) {
      return res.status(400).json({
        ok: false,
        message: "teacherId, startDate, endDate are required",
      });
    }

    const teacherIdStr = String(teacherId); // always compare as string
    const start = new Date(startDate);
    const end = new Date(endDate);

    const leaveDates = getDatesBetween(start, end);
    const affectedPeriods = [];

    for (const date of leaveDates) {
      const dow = date.toLocaleString("en-US", { weekday: "short" }); // "Mon","Tue"...
      const weekStart = getWeekStart(date);

      console.log(
        "=== Checking date ===",
        date,
        "dow:",
        dow,
        "weekStart:",
        weekStart
      );

      const timetables = await Timetable.find({
        weekStart,
        status: "published",
      }).lean();
      console.log("Timetables found:", timetables.length);

      for (const tt of timetables) {
        console.log(
          "Timetable classroom:",
          tt.classroom,
          "entries:",
          tt.entries?.length
        );

        (tt.entries || []).forEach((entry) => {
          console.log(
            "ENTRY >>",
            "day:",
            entry.day,
            "period:",
            entry.periodKey,
            "teacher:",
            entry.teacher?.toString()
          );

          if (
            entry.teacher &&
            entry.teacher.toString() === String(teacherId) &&
            entry.day === dow
          ) {
            console.log("✅ MATCH FOUND");
            affectedPeriods.push({
              date,
              day: entry.day,
              periodKey: entry.periodKey,
              subject: entry.subject,
              classroomId: tt.classroom,
            });
          }
        });
      }
    }

    // Save leave
    const leave = await Leave.create({
      teacherId,
      startDate: start,
      endDate: end,
      periods: affectedPeriods,
      reason: reason || "",
      status: "PENDING",
    });

    res.json({ ok: true, leave });
  } catch (err) {
    console.error("createLeave error:", err);
    res
      .status(500)
      .json({ ok: false, message: err.message || "Internal error" });
  }
}

async function getLeavesByTeacher(req, res) {
  try {
    const { teacherId } = req.params;

    // Example: GET /leaves/teacher/68be98930dd917afc64e9a81
    const leaves = await Leave.find({ teacherId: teacherId })
      .populate("teacherId", "name email")
      .populate("periods.subject", "name code")
      .populate("periods.classroomId", "name");

    res.status(200).json(leaves);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Get all leaves (principal view)
// Get all leaves (principal view) with optional filters
async function getAllLeaves(req, res) {
  try {
    const { status, from, to } = req.query;

    // Build filter
    const filter = {};

    // Status filter
    if (status && status !== "ALL") {
      filter.status = status;
    }

    // Date range filter
    if (from || to) {
      filter.startDate = {};
      if (from) filter.startDate.$gte = new Date(from);
      if (to) filter.startDate.$lte = new Date(to);
    }

    const leaves = await Leave.find(filter)
      .populate("teacherId", "fname lname email role")
      .populate("periods.subject", "name code")
      .populate("periods.classroomId", "name");

    res.status(200).json(leaves);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}


async function rejectLeave(req, res) {
  try {
    const { id } = req.params;
    const approverId = req.user?._id || req.body.approverId || null;
    const { remark } = req.body;

    const leave = await Leave.findById(id);
    if (!leave)
      return res.status(404).json({ ok: false, message: "Leave not found" });
    if (leave.status !== "PENDING")
      return res
        .status(400)
        .json({ ok: false, message: "Only pending leaves can be rejected" });

    leave.status = "REJECTED";
    if (approverId) leave.approverId = approverId;
    if (remark)
      leave.reason = `${leave.reason || ""}\n[Rejection Remark] ${remark}`;
    await leave.save();

    res.json({ ok: true, leave });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
}

async function cancelLeave(req, res) {
  try {
    const { id } = req.params;
    const leave = await Leave.findById(id);
    if (!leave)
      return res.status(404).json({ ok: false, message: "Leave not found" });
    if (leave.status === "CANCELLED")
      return res.status(200).json({ ok: true, leave });

    leave.status = "CANCELLED";
    await leave.save();
    res.json({ ok: true, leave });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
}
module.exports = {
  createLeave,
  getAllLeaves,
  getLeavesByTeacher,
  rejectLeave,
  cancelLeave,
};
