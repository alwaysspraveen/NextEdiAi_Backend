const Attendance = require("../models/Attendance");
const mongoose = require("mongoose");
const asyncHandler = require("../utils/asyncHandler");
const Classroom = require("../models/Classroom");
const dayjs = require("dayjs");
// If you have a tenant helper:
const { T } = require("../utils/tenant"); // adjust path; or inline tenant filter from req.user.tenant

// Normalize to day range
function dayBounds(dateStr) {
  const start = dayjs(dateStr).startOf("day").toDate();
  const end = dayjs(dateStr).endOf("day").toDate();
  return { start, end };
}

exports.markAttendance = asyncHandler(async (req, res) => {
  const { classId, date, subject, teacher, records } = req.body;

  if (!classId || !date || !records) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  // 🔥 Normalize to start of day
  const normalizedDate = new Date(dayjs(date).format("YYYY-MM-DD"));

  const attendance = await Attendance.create({
    classId,
    date: normalizedDate, // Use normalized date
    subject,
    teacher,
    records: records.map((r) => ({
      student: r.student,
      status: r.status,
      note: r.note || "",
    })),
  });

  res.status(201).json(attendance);
});

exports.getAttendanceByClassDate = asyncHandler(async (req, res) => {
  const { classId, date } = req.params;
  let { subject } = req.query || {};
  if (!classId || !date) {
    return res.status(400).json({ message: "classId and date are required" });
  }
  if (subject === "null" || subject === "undefined" || subject === "")
    subject = undefined;

  const start = dayjs(date).startOf("day").toDate();
  const end = dayjs(date).endOf("day").toDate();

  const filter = { classId, date: { $gte: start, $lte: end } };
  if (subject) filter.subject = subject;

  const doc = await Attendance.findOne(filter)
    .populate("teacher", "name fname lname email")
    .populate("subject", "name code")
    .populate("records.student", "name fname lname email rollNo")
    .lean();

  res.json({
    classId,
    date: dayjs(date).format("YYYY-MM-DD"),
    subject: subject ?? null,
    records: doc?.records || [],
  });
});

/**
 * Daily summary counts for a class (present/absent/leave/total).
 * Params: :classId/:date
 */
exports.classwiseSummaryDaily = async (req, res) => {
  try {
    const { date, classId, classroomId, minPct, onlyUnmarked } = req.query;
    const cid = classId || classroomId;

    const d = dayjs(date, "YYYY-MM-DD");
    const start = d.startOf("day").toDate();
    const end = d.endOf("day").toDate();

    const classMatch = {};
    if (cid && mongoose.isValidObjectId(cid)) {
      classMatch._id = new mongoose.Types.ObjectId(cid);
    }

    const pipeline = [
      { $match: classMatch },

      // --- total students ---
      {
        $lookup: {
          from: "users",
          let: { cid: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$class", "$$cid"] } } },
            { $match: { role: "STUDENT", isActive: { $ne: false } } },
            { $project: { _id: 1, name: 1 } },
          ],
          as: "students",
        },
      },
      { $addFields: { total: { $size: "$students" } } },

      // --- map each student with attendance record for the day ---
      {
        $lookup: {
          from: "attendances",
          let: { cid: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$classId", "$$cid"] },
                    { $gte: ["$date", start] },
                    { $lt: ["$date", end] },
                  ],
                },
              },
            },
            { $unwind: "$records" },
            {
              $project: {
                student: "$records.student",
                status: "$records.status",
              },
            },
          ],
          as: "attendanceDocs",
        },
      },

      // --- join attendanceDocs back to students ---
      {
        $addFields: {
          roster: {
            $map: {
              input: "$students",
              as: "stu",
              in: {
                _id: "$$stu._id",
                status: {
                  $first: {
                    $map: {
                      input: {
                        $filter: {
                          input: "$attendanceDocs",
                          as: "a",
                          cond: { $eq: ["$$a.student", "$$stu._id"] },
                        },
                      },
                      as: "a",
                      in: "$$a.status",
                    },
                  },
                },
              },
            },
          },
        },
      },

      // --- compute counts ---
      {
        $addFields: {
          present: {
            $size: {
              $filter: {
                input: "$roster",
                as: "r",
                cond: { $eq: ["$$r.status", "P"] },
              },
            },
          },
          late: {
            $size: {
              $filter: {
                input: "$roster",
                as: "r",
                cond: { $eq: ["$$r.status", "L"] },
              },
            },
          },
          absent: {
            $size: {
              $filter: {
                input: "$roster",
                as: "r",
                cond: { $eq: ["$$r.status", "A"] },
              },
            },
          },
          unmarked: {
            $size: {
              $filter: {
                input: "$roster",
                as: "r",
                cond: { $eq: ["$$r.status", null] },
              },
            },
          },
        },
      },

      // --- percentage ---
      {
        $addFields: {
          percentage: {
            $cond: [
              { $gt: ["$total", 0] },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: [{ $add: ["$present", "$late"] }, "$total"] },
                      100,
                    ],
                  },
                  2,
                ],
              },
              0,
            ],
          },
        },
      },

      ...(onlyUnmarked === "true"
        ? [{ $match: { unmarked: { $gt: 0 } } }]
        : []),
      ...(minPct ? [{ $match: { percentage: { $lt: Number(minPct) } } }] : []),

      {
        $project: {
          _id: 0,
          classroom: { _id: "$_id", name: "$name", section: "$section" },
          total: 1,
          present: 1,
          late: 1,
          absent: 1,
          unmarked: 1,
          percentage: 1,
        },
      },
    ];

    const result = await Classroom.aggregate(pipeline);
    res.json({ date: start, items: result });
  } catch (err) {
    console.error("classwiseSummaryDaily error", err);
    res.status(500).json({ error: err.message || "Internal error" });
  }
};

exports.studentsMonthly = asyncHandler(async (req, res) => {
  try {
    const { classId, year, month } = req.params;
    if (!classId || !year || !month) {
      return res
        .status(400)
        .json({ message: "classId, year, month are required" });
    }

    const start = dayjs(`${year}-${month}-01`).startOf("month");
    const end = start.endOf("month");

    const docs = await Attendance.find({
      classId: new mongoose.Types.ObjectId(classId),
      date: { $gte: start.toDate(), $lte: end.toDate() },
    })
      .select("records date classId")
      .populate("records.student", "fname lname email") // ✅ pulls user info
      .lean();

    const stats = {};

    for (const d of docs) {
      for (const r of d.records) {
        if (!r.student) continue; // skip empty
        const sid = String(r.student._id);

        if (!stats[sid]) {
          stats[sid] = {
            studentId: sid,
            fname: r.student.fname,
            lname: r.student.lname,
            email: r.student.email,
            present: 0,
            late: 0,
            absent: 0,
            total: 0,
          };
        }

        stats[sid].total++;
        if (r.status === "P") stats[sid].present++;
        else if (r.status === "L") stats[sid].late++;
        else if (r.status === "A") stats[sid].absent++;
      }
    }

    const result = Object.values(stats).map((s) => ({
      ...s,
      month: start.format("YYYY-MM"),
      percent: s.total ? Math.round((s.present / s.total) * 100) : 0,
    }));

    res.json(result);
  } catch (err) {
    console.error("❌ Error in studentsMonthly:", err);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: err.message });
  }
});

exports.getStudentAttendance = asyncHandler(async (req, res) => {
  const { studentId } = req.params;

  const records = await Attendance.find({ "records.student": studentId })
    .populate("records.student", "_id fname lname rollNo") // pull needed fields
    .populate("classId", "name section")
    .populate("subject", "name code") // if Attendance schema has subject ref
    .lean();

  if (!records.length) {
    return res
      .status(404)
      .json({ success: false, message: "No attendance found" });
  }

  const result = [];

  for (const doc of records) {
    for (const rec of doc.records) {
      const sid = rec.student?._id?.toString() || rec.student.toString();
      if (sid === studentId) {
        const dayjs = require("dayjs");

        result.push({
          date: dayjs(doc.date).format("YYYY-MM-DD"), // ✅ formatted date
          status:
            rec.status === "P"
              ? "present"
              : rec.status === "A"
              ? "absent"
              : rec.status === "L"
              ? "late"
              : "late",
          subject: doc.subject?.name || rec.subject || "Unknown",
          remark: rec.note || "",
        });
      }
    }
  }

  res.json({
    success: true,
    studentId,
    data: result,
  });
});
