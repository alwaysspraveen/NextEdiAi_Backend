const asyncHandler = require("../utils/asyncHandler");
const Classroom = require("../models/Classroom");
const Subject = require("../models/Subject");
const User = require("../models/User");
const { T } = require("../utils/tenant");

/**
 * Create a new subject
 */
exports.createSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.create({
    ...req.body,
    tenant: req.user.tenant,
  });
  res.status(201).json(subject);
});

/**
 * List subjects, optionally filtered by classroom or teacher
 */
exports.listSubjects = asyncHandler(async (req, res) => {
  const filter = T(req);
  if (req.query.classroom) filter.classroom = req.query.classroom;
  if (req.query.teacher) filter.teacher = req.query.teacher;

  const subjects = await Subject.find(filter)
    .populate("classroom", "name")
    .populate("teacher", "fname lname name email")
    .lean();

  res.json(subjects);
});

exports.getSubjectsByClassAndTeacher = asyncHandler(async (req, res) => {
  // Accept both path params and query params
  const classId = req.params.classId ?? req.query.classId ?? null;
  const teacherId = req.params.teacherId ?? req.query.teacherId ?? null;

  if (!teacherId) {
    return res.status(400).json({ message: "teacherId parameter is required" });
  }

  // Build filter dynamically: classroom only when provided
  const filter = { teacher: teacherId };
  if (classId && classId !== "all") {
    filter.classroom = classId;
  }

  const subjects = await Subject.find(T(req, filter))
    .populate("classroom", "name")
    .populate("teacher", "fname lname name email");

  return res.json(subjects);
});
exports.getSubjectsByClass = asyncHandler(async (req, res) => {
  const classId = req.params.classId;

  if (!classId) {
    return res.status(400).json({ message: "classId parameter is required" });
  }

  if (!classId) {
    return res.status(404).json({ message: "Class not found" });
  }

  const subjects = await Subject.find(T(req, { classroom: classId }))
    .populate("classroom", "name")
    .populate("teacher", "fname lname name email");

  res.json(subjects);
});

/**
 * Assign a teacher to a subject
 */
exports.assignTeacher = asyncHandler(async (req, res) => {
  const { subjectId, teacherId } = req.body;

  const subject = await Subject.findOne(T(req, { _id: subjectId }));
  const teacher = await User.findOne(
    T(req, { _id: teacherId, role: "TEACHER" })
  );

  if (!subject || !teacher) {
    res.status(400).json({ message: "Invalid subject or teacher ID" });
    return;
  }

  subject.teacher = teacherId;
  await subject.save();

  res.json(subject);
});

/**
 * Update a subject
 */
exports.updateSubject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await Subject.findOneAndUpdate(
    T(req, { _id: id }),
    req.body,
    {
      new: true,
    }
  );
  res.json(updated);
});

/**
 * Delete a subject
 */
exports.removeSubject = asyncHandler(async (req, res) => {
  await Subject.findOneAndDelete(T(req, { _id: req.params.id }));
  res.json({ ok: true });
});
