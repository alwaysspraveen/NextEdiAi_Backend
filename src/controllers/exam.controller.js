const asyncHandler = require("../utils/asyncHandler");
const Exam = require("../models/Exam");
const Mark = require("../models/Mark");
const { T } = require("../utils/tenant");
const band = (p) =>
  p >= 90
    ? "A+"
    : p >= 80
    ? "A"
    : p >= 70
    ? "B"
    : p >= 60
    ? "C"
    : p >= 50
    ? "D"
    : "F";

exports.createExam = asyncHandler(async (req, res) => {
  const exam = await Exam.create({ ...req.body, tenant: req.tenantId });
  res.status(201).json(exam);
});

exports.enterMarksBulk = asyncHandler(async (req, res) => {
  const { examId, marks } = req.body;
  const exam = await Exam.findOne(T(req, { _id: examId }));
  if (!exam) throw Object.assign(new Error("Exam not found"), { status: 404 });
  const ops = marks.map((m) => {
    const pct = (m.score / exam.maxMarks) * 100;
    return {
      updateOne: {
        filter: T(req, { exam: examId, student: m.student }),
        update: {
          tenant: req.tenantId,
          exam: examId,
          student: m.student,
          score: m.score,
          grade: band(pct),
        },
        upsert: true,
      },
    };
  });
  await Mark.bulkWrite(ops);
  res.json({ ok: true });
});

exports.classResults = asyncHandler(async (req, res) => {
  const marks = await Mark.find(T(req, { exam: req.params.examId })).populate(
    "student",
    "name"
  );
  res.json(marks);
});

exports.reportCard = asyncHandler(async (req, res) => {
  const { classroomId, studentId } = req.query;
  const exams = await Exam.find(T(req, { classroom: classroomId }));
  const marks = await Mark.find(
    T(req, { exam: { $in: exams.map((e) => e._id) }, student: studentId })
  ).populate("exam");
  res.json({ exams, marks });
});
