const TimeTable = require("../models/TimeTable");
const Classroom = require("../models/Classroom");
const Subject = require("../models/Subject");
const User = require("../models/User");
const Substitution = require("../models/Substitution");
const dayjs = require("dayjs");
const Leave = require("../models/Leave");
const asyncHandler = require("../utils/asyncHandler");
const { T } = require("../utils/tenant");
const utc = require("dayjs/plugin/utc");
const isoWeek = require("dayjs/plugin/isoWeek"); // Monday as start of week
dayjs.extend(utc);
dayjs.extend(isoWeek);
// ---- utilities ----
const DEFAULT_TEMPLATE = {
  workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  periods: [
    { key: "P1", label: "P1" },
    { key: "P2", label: "P2" },
    { key: "P3", label: "P3" },
    { key: "BREAK", label: "Break", isBreak: true },
    { key: "P4", label: "P4" },
    { key: "P5", label: "P5" },
    { key: "P6", label: "P6" },
  ],
};

function normalizeWeekStart(d) {
  return dayjs.utc(d).startOf("week").add(1, "day").toDate(); // Monday 00:00 UTC
}

const normId = (v) => {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v._id || v.value || null;
  try {
    return String(v);
  } catch {
    return null;
  }
};

exports.getTimetable = asyncHandler(async (req, res) => {
  const { classroomId, weekStart } = req.query;

  if (!classroomId || !weekStart)
    return res
      .status(400)
      .json({ message: "classroomId & weekStart required" });

  const weekStartNorm = normalizeWeekStart(weekStart);

  const tt = await TimeTable.findOne(
    T(req, {
      classroom: classroomId,
      weekStart: weekStartNorm,
    })
  ).lean();

  res.json(tt?.entries || []);
});

exports.generateTimetable = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant || req.tenantId;
  const { classroomId, weekStart } = req.body;

  if (!classroomId) {
    return res.status(400).json({ message: "classroomId is required" });
  }
  const wk = normalizeWeekStart(weekStart);
  if (!wk) {
    return res.status(400).json({ message: "Invalid weekStart" });
  }

  if (!wk) {
    return res.status(400).json({ message: "Invalid weekStart" });
  }

  // Check classroom exists
  const classroom = await Classroom.findOne(
    T(req, { _id: classroomId })
  ).lean();
  if (!classroom) {
    return res.status(404).json({ message: "Classroom not found" });
  }

  // Load subjects for this class (with teacher)
  const subjects = await Subject.find(T(req, { classroom: classroomId }))
    .populate("teacher", "_id name")
    .lean();

  if (!subjects.length) {
    return res
      .status(400)
      .json({ message: "No subjects defined for this class" });
  }

  // Build simple round-robin over available teaching slots (non-break)
  const days = DEFAULT_TEMPLATE.workingDays;
  const periods = DEFAULT_TEMPLATE.periods.filter((p) => !p.isBreak); // non-break slots

  const entries = [];
  let idx = 0;

  for (const day of days) {
    for (const p of DEFAULT_TEMPLATE.periods) {
      if (p.isBreak) {
        entries.push({ day, periodKey: p.key, isBreak: true });
        continue;
      }
      const subj = subjects[idx % subjects.length];
      const teacherId = subj.teacher ? subj.teacher._id : undefined;

      entries.push({
        day,
        periodKey: p.key,
        subject: subj._id,
        teacher: teacherId,
        isBreak: false,
      });

      idx++;
    }
  }

  // Upsert timetable
  const doc = await TimeTable.findOneAndUpdate(
    T(req, { classroom: classroomId, weekStart: wk }),
    {
      $set: { entries, status: "draft" },
      $setOnInsert: { tenant: tenantId, classroom: classroomId, weekStart: wk },
    },
    { upsert: true, new: true }
  );

  // Map to front-end TTEntry
  const out = (doc.entries || []).map((e) => ({
    day: e.day,
    periodKey: e.periodKey,
    subjectId: e.subject ? e.subject.toString() : undefined,
    teacherId: e.teacher ? e.teacher.toString() : undefined,
  }));

  res.status(201).json(out);
});

const BREAK_KEYS = new Set(["BREAK", "LUNCH", "RECESS"]);

exports.validateTimetable = asyncHandler(async (req, res) => {
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  const conflicts = [];

  const slotTeachers = new Map();

  for (const e of entries) {
    const periodKey = String(e.periodKey || "").toUpperCase();
    const isBreak = !!e.isBreak || BREAK_KEYS.has(periodKey);
    if (isBreak) continue;

    // normalize ids (support both subject / subjectId and teacher / teacherId)
    const subjectId = e.subjectId || e.subject;
    const teacherId = e.teacherId || e.teacher;

    if (!e.periodKey) conflicts.push(`Missing periodKey on ${e.day}`);
    if (!subjectId)
      conflicts.push(`Missing subject on ${e.day} ${e.periodKey}`);
    if (!teacherId)
      conflicts.push(`Missing teacher on ${e.day} ${e.periodKey}`);

    if (teacherId) {
      const key = `${e.day}_${e.periodKey}`;
      const set = slotTeachers.get(key) || new Set();
      if (set.has(teacherId)) conflicts.push(`Teacher overlap at ${key}`);
      set.add(teacherId);
      slotTeachers.set(key, set);
    }
  }

  res.json({ conflicts });
});

exports.publishTimetable = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant || req.tenantId;
  const { classroomId, weekStart, entries } = req.body;

  if (!classroomId || !weekStart || !Array.isArray(entries)) {
    return res.status(400).json({
      message: "classroomId, weekStart and entries[] are required",
    });
  }

  const weekStartNorm = normalizeWeekStart(weekStart);
  if (!weekStartNorm) {
    return res.status(400).json({ message: "Invalid weekStart" });
  }

  const cleaned = entries.map((e) => ({
    day: e.day,
    periodKey: e.periodKey,
    subject: e.subjectId || null,
    teacher: e.teacherId || null,
    roomId: e.room || null,
    isBreak:
      !!e.isBreak || BREAK_KEYS.has(String(e.periodKey || "").toUpperCase()),
  }));

  const query = {
    classroom: classroomId,
    weekStart: weekStartNorm,
    tenant: tenantId,
  };
  const update = { $set: { entries: cleaned, status: "published" } };
  const opts = { new: true, upsert: true };

  const saved = await TimeTable.findOneAndUpdate(query, update, opts);
  res.json({ ok: true, timetable: saved });
});

// Auto substitute logic (invoked via cron or on leave insert)
exports.autoAssignSubstitute = asyncHandler(async (req, res) => {
  const { teacherId, date } = req.body;

  const leaveDate = new Date(date);
  const day = leaveDate.toLocaleDateString("en-US", { weekday: "long" });

  const slots = await TimeTable.find({
    "entries.teacher": teacherId,
    "entries.day": day,
  });

  const availableSubs = await User.find({ role: "TEACHER" }); // refine logic

  for (let slot of slots) {
    const sub = availableSubs.find(
      (t) => t._id.toString() !== teacherId.toString()
    );
    if (sub) {
      await TimeTable.updateOne(
        { _id: slot._id },
        { substituteTeacher: sub._id }
      );
    }
  }

  res.json({ message: "Substitutes assigned" });
});

// Map periodKey -> start/end (24h)
const PERIOD_SLOTS = {
  P1: { start: "09:00", end: "09:45" },
  P2: { start: "09:45", end: "10:30" },
  P3: { start: "10:30", end: "11:30" },
  P4: { start: "11:30", end: "12:15" },
  P5: { start: "12:45", end: "13:30" },
  P6: { start: "14:30", end: "15:15" }, // ✅ corrected
  P7: { start: "15:15", end: "16:00" }, // shift others accordingly if needed
};

function dayIndex(d) {
  const map = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const key = (d || "").slice(0, 3);
  return map[key] ?? 0;
}

function dateAt(weekStart, offset, slotTime) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + offset); // local day shift
  const [hh, mm] = slotTime.split(":").map(Number);
  d.setHours(hh, mm, 0, 0); // set local hours/minutes
  return d;
}

function minutesBetween(a, b) {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

// --- date helpers (local time; switch to setUTCHours(...) if you store UTC in DB)
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function sameYMD(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

exports.getTimetableByTeacher = asyncHandler(async (req, res) => {
  const { teacherId } = req.params;
  if (!teacherId)
    return res.status(400).json({ message: "teacherId is required" });

  const today = new Date();
  const weekStartNorm = normalizeWeekStart(today);
  const todayDay = today.toLocaleDateString("en-US", { weekday: "short" }); // "Mon"

  // 1) Pull timetables for this week that include this teacher
  const timetables = await TimeTable.find(
    T(req, { weekStart: weekStartNorm, "entries.teacher": teacherId })
  )
    .populate("classroom", "name section")
    .populate("entries.subject", "name code")
    .lean();

  if (!timetables.length) return res.json({ day: todayDay, items: [] });

  // 2) Preload today's leaves & substitutions for this teacher
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const [leavesToday, substitutionsToday] = await Promise.all([
    Leave.find({
      teacherId,
      status: "APPROVED",
      startDate: { $lte: endOfDay },
      endDate: { $gte: startOfDay },
    }).lean(),
    Substitution.find({
      date: { $gte: startOfDay, $lte: endOfDay }, // happening today
      originalTeacherId: teacherId, // this teacher is being covered
    })
      .populate("substituteTeacherId", "name email")
      .lean(),
  ]);

  const hasLeaveToday = leavesToday.length > 0;

  // Build quick lookup for substitutions: `${classroomId}-${periodKey}` -> substitution doc
  const subMap = new Map();
  for (const s of substitutionsToday) {
    subMap.set(`${String(s.classroom)}-${s.periodKey}`, s);
  }

  // 3) Build output (today only)
  const now = new Date();
  const items = [];

  for (const tt of timetables) {
    for (const e of tt.entries || []) {
      if (
        String(e.teacher) !== String(teacherId) ||
        !e.day ||
        !e.day.toLowerCase().startsWith(todayDay.toLowerCase()) ||
        e.isBreak
      )
        continue;

      const slot = PERIOD_SLOTS[e.periodKey];
      let start = null,
        end = null;
      if (slot) {
        const offset = dayIndex(e.day);
        start = dateAt(weekStartNorm, offset, slot.start);
        end = dateAt(weekStartNorm, offset, slot.end);
      }

      const durationMin = start && end ? minutesBetween(start, end) : null;
      const subKey = `${String(tt.classroom?._id || "")}-${e.periodKey}`;
      const substitution = subMap.get(subKey);

      let status; // "Live" | "Upcoming" | "Cancelled" | "Substitutes"
      if (hasLeaveToday) {
        status = substitution ? "Substitutes" : "Cancelled";
      } else if (start && end && now >= start && now < end) {
        status = "Live";
      } else if (start && now < start) {
        status = "Upcoming";
      } else {
        status = "Upcoming"; // or "Past" if you prefer
      }

      items.push({
        classroom: tt.classroom
          ? `${tt.classroom.name}${
              tt.classroom.section ? "-" + tt.classroom.section : ""
            }`
          : null,
        day: e.day,
        periodKey: e.periodKey,
        subjectId: e.subject?._id || null,
        subjectName: e.subject?.name || null,
        teacherId,
        isBreak: !!e.isBreak,

        // new fields:
        status, // "Live" | "Upcoming" | "Cancelled" | "Substitutes"
        start, // Date
        end, // Date
        durationMin, // Number

        substitute: substitution
          ? {
              id:
                substitution.substituteTeacherId?._id ||
                substitution.substituteTeacherId,
              name:
                substitution.substituteTeacherId?.name ||
                substitution.substituteTeacherName,
            }
          : null,
      });
    }
  }

  res.json({ day: todayDay, items });
});

exports.getTimetableByTeacherByDay = asyncHandler(async (req, res) => {
  const { teacherId, day } = req.params;
  if (!teacherId)
    return res.status(400).json({ message: "teacherId is required" });
  let targetDate;
  if (day) {
    // Use this week’s named day
    const label = String(day).trim();
    const dayKey = label.slice(0, 3).toLowerCase(); // mon/tue/...
    const idxMap = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
    if (!(dayKey in idxMap))
      return res.status(400).json({ message: "Invalid day (use Mon/Tue/...)" });
    // Base week = this week (today)
    const today = new Date();
    const weekStart = normalizeWeekStart(today);
    targetDate = new Date(weekStart);
    targetDate.setDate(weekStart.getDate() + idxMap[dayKey]);
  } else {
    // Default: today
    targetDate = new Date();
  }

  const weekStartNorm = normalizeWeekStart(targetDate);
  const dayLabel = targetDate.toLocaleDateString("en-US", { weekday: "short" }); // "Mon"

  // 1) Pull timetables for the right week that include this teacher
  const timetables = await TimeTable.find(
    T(req, { weekStart: weekStartNorm, "entries.teacher": teacherId })
  )
    .populate("classroom", "name section")
    .populate("entries.subject", "name code")
    .lean();

  if (!timetables.length)
    return res.json({ day: dayLabel, date: targetDate, items: [] });

  // 2) Leaves & substitutions for the TARGET calendar day
  const sod = startOfDay(targetDate);
  const eod = endOfDay(targetDate);

  const [leavesOnDay, substitutionsOnDay] = await Promise.all([
    Leave.find({
      teacherId,
      status: "APPROVED",
      startDate: { $lte: eod },
      endDate: { $gte: sod },
    }).lean(),
    Substitution.find({
      date: { $gte: sod, $lte: eod },
      originalTeacherId: teacherId,
    })
      .populate("substituteTeacherId", "name email")
      .lean(),
  ]);

  const hasLeaveThatDay = leavesOnDay.length > 0;

  const subMap = new Map();
  for (const s of substitutionsOnDay) {
    subMap.set(`${String(s.classroom)}-${s.periodKey}`, s);
  }

  // 3) Build items for that day only
  const now = new Date();
  const nowIsTargetDay = sameYMD(now, targetDate);
  const items = [];

  for (const tt of timetables) {
    for (const e of tt.entries || []) {
      if (
        String(e.teacher) !== String(teacherId) ||
        !e.day ||
        !e.day.toLowerCase().startsWith(dayLabel.toLowerCase()) ||
        e.isBreak
      )
        continue;

      const slot = PERIOD_SLOTS[e.periodKey];
      let start = null,
        end = null;
      if (slot) {
        const offset = dayIndex(e.day);
        start = dateAt(weekStartNorm, offset, slot.start);
        end = dateAt(weekStartNorm, offset, slot.end);
      }

      const durationMin = start && end ? minutesBetween(start, end) : null;
      const subKey = `${String(tt.classroom?._id || "")}-${e.periodKey}`;
      const substitution = subMap.get(subKey);

      // decide status
      const now = Date.now(); // current UTC timestamp
      const startMs = start ? new Date(start).getTime() : null;
      const endMs = end ? new Date(end).getTime() : null;

      let status;

      if (hasLeaveThatDay) {
        status = substitution ? "Substitutes" : "Cancelled";
      } else if (startMs && endMs) {
        if (now < startMs) {
          status = "Upcoming";
        } else if (now >= startMs && now <= endMs) {
          status = "Live";
        } else {
          status = "Completed";
        }
      } else {
        status = "Upcoming";
      }

      items.push({
        classroom: tt.classroom
          ? `${tt.classroom.name}${
              tt.classroom.section ? "-" + tt.classroom.section : ""
            }`
          : null,
        day: e.day,
        periodKey: e.periodKey,
        subjectId: e.subject?._id || null,
        subjectName: e.subject?.name || null,
        teacherId,
        isBreak: !!e.isBreak,

        status,
        start,
        end,
        durationMin,

        substitute: substitution
          ? {
              id:
                substitution.substituteTeacherId?._id ||
                substitution.substituteTeacherId,
              name:
                substitution.substituteTeacherId?.name ||
                substitution.substituteTeacherName,
            }
          : null,
      });
    }
  }

  res.json({ day: dayLabel, date: targetDate, items });
});
