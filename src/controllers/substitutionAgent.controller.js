const dayjs = require("dayjs");
const Teacher = require("../models/User");
const TimeTableEntry = require("../models/TimeTable");
const Substitution = require("../models/Substitution");
const Leave = require("../models/Leave");

function dowAbbr(d) {
  return dayjs(d).format("ddd");
} // 'Mon'..'Sun'
function normalizeDayStart(d) {
  return dayjs(d).startOf("day").toDate();
}
function weekBounds(d) {
  const start = dayjs(d).startOf("week").add(1, "day"); // Monday start
  const end = start.add(6, "day").endOf("day");
  return { start: start.toDate(), end: end.toDate() };
}
function computeWeekStart(date) {
  // Always force UTC Monday 00:00
  return dayjs(date)
    .utc()
    .startOf("week")
    .add(1, "day")
    .startOf("day")
    .toDate();
}

async function getWeeklyTimetableForSlot(classroomId, date) {
  const weekStart = computeWeekStart(date);
  return await TimeTableEntry.findOne({
    classroom: new Types.ObjectId(classroomId),
    status: "published",
    weekStart: weekStart, // exact match for Monday of that week
  }).lean();
}

async function approveLeaveAndSchedule(req, res) {
  try {
    const { id } = req.params;
    const leave = await Leave.findById(id);
    if (!leave)
      return res.status(404).json({ ok: false, message: "Leave not found" });

    leave.status = "APPROVED";
    await leave.save();

    const plan = await scheduleForApprovedLeaveInternal(leave);
    res.json({ ok: true, substitutions: plan });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ ok: false, message: err.message || "Internal error" });
  }
}

async function listSubstitutions(req, res) {
  try {
    const { classroomId, from, to } = req.query;
    const q = {};
    if (classroomId) q.classroomId = classroomId;
    if (from || to) q.date = {};
    if (from) q.date.$gte = dayjs(from).startOf("day").toDate();
    if (to) q.date.$lte = dayjs(to).endOf("day").toDate();

    const rows = await Substitution.find(q).lean();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ ok: false, message: err.message || "Internal error" });
  }
}

/** ===== Core agent ===== */

async function scheduleForApprovedLeaveInternal(leave) {
  const absentTeacherId = String(leave.teacherId);

  // ✅ Use leave.periods directly
  const slots = (leave.periods || []).map((p) => ({
    date: p.date,
    day: p.day,
    periodKey: p.periodKey,
    classroomId: String(p.classroomId),
    subjectId: p.subject ? String(p.subject) : null,
  }));

  // fairness counters for the week that includes the leave
  const { start: weekStart, end: weekEnd } = weekBounds(leave.startDate);
  const weeklyCounts = await countWeeklySubAssignments(weekStart, weekEnd);

  const results = [];
  for (const slot of slots) {
    const best = await pickBestSub(slot, weeklyCounts, absentTeacherId);
    const doc = await writeOverride(slot, absentTeacherId, best);
    results.push(doc);

    if (best && best.id) {
      weeklyCounts[best.id] = (weeklyCounts[best.id] || 0) + 1;
    }
  }
  return results;
}

async function computeAffectedSlots(
  absentTeacherId,
  startDate,
  endDate,
  onlyPeriods
) {
  const out = [];
  let cursor = dayjs(startDate).startOf("day");
  const end = dayjs(endDate).endOf("day");

  while (cursor.isBefore(end) || cursor.isSame(end, "day")) {
    const dow = cursor.format("ddd"); // "Mon"..."Sat"

    // find the weekly timetable that covers this date
    const weekStart = dayjs(cursor).startOf("week").add(1, "day").toDate();
    const timetable = await TimeTableEntry.findOne({
      weekStart,
      status: "published",
    }).lean();

    if (timetable && Array.isArray(timetable.entries)) {
      timetable.entries
        .filter(
          (e) => e.day === dow && String(e.teacher) === String(absentTeacherId)
        )
        .forEach((e) => {
          out.push({
            date: cursor.toDate(),
            day: dow,
            periodKey: e.periodKey,
            classroomId: String(timetable.classroom), // ✅ correct field
            subjectId: e.subject ? String(e.subject) : null,
          });
        });
    }

    cursor = cursor.add(1, "day");
  }

  return out;
}
const Subject = require("../models/Subject");

async function pickBestSub(slot, weeklyCounts, absentTeacherId) {
  let candidates = [];

  // Step 1: Get the subject info from Subject collection
  if (slot.subjectId) {
    const subject = await Subject.findById(slot.subjectId).lean();
    if (subject && subject.teacher) {
      // Candidate = teacher assigned to this subject
      const subjectTeacherId = String(subject.teacher);

      // Only if it's not the absent teacher
      if (subjectTeacherId !== String(absentTeacherId)) {
        candidates.push(subjectTeacherId);
      }
    }
  }

  // Step 2: Filter free teachers
  let freeTeachers = await filterFreeTeachers(
    candidates,
    slot,
    absentTeacherId
  );

  let best = null;
  for (const id of freeTeachers) {
    const score = await scoreCandidate(id, slot, weeklyCounts, 50);
    if (!best || score > best.score) {
      best = { id, score, mode: "SUBJECT" };
    }
  }

  if (best) return best;

  // Step 3: Fallback — any teacher
  const allTeachers = await Teacher.find(
    { role: "TEACHER" },
    { _id: 1 }
  ).lean();
  const allIds = allTeachers.map((t) => String(t._id));
  const freeAny = await filterFreeTeachers(allIds, slot, absentTeacherId);

  if (!freeAny.length) {
    return { id: null, score: -1, mode: "SUPERVISION" };
  }

  for (const id of freeAny) {
    const score = await scoreCandidate(id, slot, weeklyCounts, 5);
    if (!best || score > best.score) {
      best = { id, score, mode: "SUPERVISION" };
    }
  }

  return best;
}

async function filterFreeTeachers(teacherIds, slot, absentTeacherId) {
  const set = new Set(
    teacherIds.filter((id) => id !== String(absentTeacherId))
  );
  if (set.size === 0) return [];

  const ids = Array.from(set).map((id) => new Types.ObjectId(id));

  // Busy in base timetable at that day/period (any class)
  const busyTT = await TimeTableEntry.find(
    {
      status: "published",
      entries: {
        $elemMatch: {
          day: slot.day,
          periodKey: slot.periodKey,
          teacher: { $in: ids },
        },
      },
    },
    { entries: 1 }
  ).lean();

  for (const doc of busyTT) {
    for (const e of doc.entries || []) {
      if (e.day === slot.day && e.periodKey === slot.periodKey && e.teacher) {
        set.delete(String(e.teacher));
      }
    }
  }

  // Already assigned to another substitution same date/period?
  const busySub = await Substitution.find(
    {
      date: dayjs(slot.date).startOf("day").toDate(),
      periodKey: slot.periodKey,
      substituteTeacherId: { $in: Array.from(set) },
    },
    { substituteTeacherId: 1 }
  ).lean();
  for (const b of busySub) set.delete(String(b.substituteTeacherId));

  // On leave that date?
  const onLeave = await Leave.find(
    {
      teacherId: { $in: Array.from(set) },
      status: "APPROVED",
      startDate: { $lte: slot.date },
      endDate: { $gte: slot.date },
    },
    { teacherId: 1 }
  ).lean();
  for (const l of onLeave) set.delete(String(l.teacherId));

  return Array.from(set);
}

async function scoreCandidate(teacherId, slot, weeklyCounts, base) {
  const dayStart = dayjs(slot.date).startOf("day").toDate();
  const dayEnd = dayjs(slot.date).endOf("day").toDate();

  const subsToday = await Substitution.countDocuments({
    substituteTeacherId: teacherId,
    date: { $gte: dayStart, $lte: dayEnd },
  });

  const subsThisWeek = weeklyCounts[teacherId] || 0;

  const t = await Teacher.findOne(
    { _id: teacherId, role: "TEACHER" },
    { maxPerDay: 1, maxPerWeek: 1 }
  ).lean();
  if (t) {
    if (subsToday >= (t.maxPerDay ?? 6)) return -1;
    if (subsThisWeek >= (t.maxPerWeek ?? 30)) return -1;
  }

  // taught this class before?
  const taughtBefore = await TimeTableEntry.exists({
    classroom: new Types.ObjectId(slot.classroomId),
    entries: { $elemMatch: { teacher: new Types.ObjectId(teacherId) } },
  });

  // adjacency (previous/next period in same class/day)
  const order = ["P1", "P2", "P3", "BREAK", "P4", "P5", "P6", "P7", "P8"];
  const idx = order.indexOf(slot.periodKey);
  const neighbors = [];
  if (idx > 0) neighbors.push(order[idx - 1]);
  if (idx >= 0 && idx < order.length - 1) neighbors.push(order[idx + 1]);

  const adjacent = await TimeTableEntry.countDocuments({
    classroom: new Types.ObjectId(slot.classroomId),
    entries: {
      $elemMatch: {
        teacher: new Types.ObjectId(teacherId),
        day: slot.day,
        periodKey: { $in: neighbors },
      },
    },
  });

  let s = base;
  if (taughtBefore) s += 10;
  s += 4 * adjacent;
  s += -0.5 * subsThisWeek;
  s += -1.0 * subsToday;
  return s;
}

const { Types } = require("mongoose");

async function writeOverride(slot, absentTeacherId, pick) {
  const subDoc = {
    date: dayjs(slot.date).startOf("day").toDate(),
    classroomId: new Types.ObjectId(slot.classroomId),
    periodKey: slot.periodKey,
    subjectId: slot.subjectId ? new Types.ObjectId(slot.subjectId) : null,
    absentTeacherId: new Types.ObjectId(absentTeacherId),
    substituteTeacherId: pick && pick.id ? new Types.ObjectId(pick.id) : null,
    mode: pick ? pick.mode : "SUPERVISION",
    note:
      !pick || !pick.id
        ? "No teacher available; mark as self-study/supervision."
        : undefined,
  };

  // 1) Save substitution
  const sub = await Substitution.findOneAndUpdate(
    {
      date: subDoc.date,
      classroomId: subDoc.classroomId,
      periodKey: subDoc.periodKey,
    },
    subDoc,
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  // 2) Update timetable entry
  const weekStart = computeWeekStart(slot.date);

  const monday = computeWeekStart(slot.date);
  const sunday = dayjs(monday).add(6, "day").endOf("day").toDate();

  const filter = {
    classroom: subDoc.classroomId,
    weekStart: { $gte: monday, $lte: sunday },
    status: { $in: ["published", "draft"] },
    entries: { $elemMatch: { day: slot.day, periodKey: slot.periodKey } },
  };

  const update = {
    $set: {
      "entries.$.absentTeacher": new Types.ObjectId(absentTeacherId),
      "entries.$.teacher": pick?.id ? new Types.ObjectId(pick.id) : null,
      "entries.$.isSubstitution": true,
    },
  };
  console.log("Filter for timetable update:", filter);

  const doc = await TimeTableEntry.findOne(filter).lean();
  console.log("Matched timetable doc:", doc ? doc._id : "NONE");
  if (doc) {
    console.log(
      "Entries snapshot:",
      doc.entries.map((e) => ({
        day: e.day,
        periodKey: e.periodKey,
        teacher: e.teacher,
      }))
    );
  }

  const result = await TimeTableEntry.updateOne(filter, update);
  console.log("Timetable update result:", result);

  return sub;
}

async function countWeeklySubAssignments(weekStart, weekEnd) {
  const rows = await Substitution.aggregate([
    { $match: { date: { $gte: weekStart, $lte: weekEnd } } },
    { $group: { _id: "$substituteTeacherId", n: { $sum: 1 } } },
  ]);
  const map = {};
  for (const r of rows) if (r._id) map[String(r._id)] = r.n;
  return map;
}

module.exports = {
  approveLeaveAndSchedule,
  listSubstitutions,
  // exported for tests if you want
  _internals: {
    scheduleForApprovedLeaveInternal,
    computeAffectedSlots,
    pickBestSub,
    filterFreeTeachers,
    scoreCandidate,
    writeOverride,
    countWeeklySubAssignments,
  },
};
