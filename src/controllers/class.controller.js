const asyncHandler = require("../utils/asyncHandler");
const Classroom = require("../models/Classroom");
const Subject = require("../models/Subject");
const User = require("../models/User");
const { T } = require("../utils/tenant");

exports.createClass = asyncHandler(async (req, res) => {
  const doc = await Classroom.create({ ...req.body, tenant: req.user.tenant });
  res.status(201).json(doc);
});

exports.getClassByTeacher = asyncHandler(async (req, res) => {
  const teacherId = req.params.teacherId; // fallback to logged-in teacher
  const classes = await Classroom.find(
    T(req, { classTeacher: teacherId })
  ).populate("classTeacher", "fname name email");

  res.json(classes);
});

exports.getClassesByName = asyncHandler(async (req, res) => {
  const classId = req.params.className;

  if (!classId) {
    return res.status(400).json({ message: "classId parameter is required" });
  }

  const classroom = await Classroom.findOne(T(req, { _id: classId }))
    .populate("classTeacher", "fname name email")
    .lean();

  if (!classroom) {
    return res.status(404).json({ message: "Class not found" });
  }

  const subjects = await Subject.find(T(req, { classroom: classId }))
    .populate("teacher", "fname name email") // Populate teacher details
    .select("name code teacher") // Select desired fields
    .lean();

  // Attach subjects to classroom object
  classroom.subjects = subjects;

  res.json([classroom]);
});


exports.updateClass = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const updates = req.body;

  const classroom = await Classroom.findOne({ _id: classId, tenant: req.user.tenant });

  if (!classroom) {
    return res.status(404).json({ error: 'Classroom not found' });
  }

  // Merge updates
  Object.assign(classroom, updates);

  // Save updated classroom
  await classroom.save();

  res.status(200).json({ message: 'Classroom updated successfully', classroom });
});

exports.listClasses = asyncHandler(async (req, res) => {
  // 1) Fetch classes (no heavy student array)
  const classes = await Classroom.find(T(req))
    .populate("classTeacher", "fname name email")
    .lean();

  const classIds = classes.map((c) => c._id);

  const [studentCounts, subjects] = await Promise.all([
    // ⚠️ Use `class` (User schema), not `classroom`
    User.aggregate([
      { $match: T(req, { role: "STUDENT", class: { $in: classIds } }) },
      { $group: { _id: "$class", total: { $sum: 1 } } },
    ]),
    Subject.find(T(req, { classroom: { $in: classIds } }))
      .populate("teacher", "fname name email")
      .select("name code teacher classroom")
      .lean(),
  ]);

  const countMap = Object.fromEntries(
    studentCounts.map((d) => [d._id.toString(), d.total])
  );

  const subjectsByClass = {};
  for (const s of subjects) {
    const key = s.classroom.toString();
    (subjectsByClass[key] ||= []).push(s);
  }

  // 4) Compose response (capacity = counted students)
  const result = classes.map((cls) => ({
    ...cls,
    capacity: countMap[cls._id.toString()] || 0,
    subjects: subjectsByClass[cls._id.toString()] || [],
  }));

  res.json(result);
});


exports.classDetail = asyncHandler(async (req, res) => {
  const cls = await Classroom.findOne(T(req, { _id: req.params.id }))
    .populate("classTeacher", "fname name")
    .populate("students", "name email");
  const subjects = await Subject.find(
    T(req, { classroom: req.params.id })
  ).populate("teacher", "name email");
  res.json({ cls, subjects });
});

exports.addStudent = asyncHandler(async (req, res) => {
  const { classId, studentId } = req.body;
  const cls = await Classroom.findOne(T(req, { _id: classId }));
  const student = await User.findOne(
    T(req, { _id: studentId, role: "STUDENT" })
  );
  if (!cls || !student)
    throw Object.assign(new Error("Invalid inputs"), { status: 400 });
  if (!cls.students.find((id) => id.toString() === studentId))
    cls.students.push(studentId);
  await cls.save();
  res.json(cls);
});

exports.removeStudent = asyncHandler(async (req, res) => {
  const { classId, studentId } = req.body;
  const cls = await Classroom.findOne(T(req, { _id: classId }));
  cls.students = cls.students.filter((s) => s.toString() !== studentId);
  await cls.save();
  res.json(cls);
});

exports.deleteClass = asyncHandler(async (req, res) => {
  const classId = req.params.classId;

  // Find and delete the class
  const cls = await Classroom.findOneAndDelete(T(req, { _id: classId }));
  if (!cls) {
    return res.status(404).json({ message: "Class not found" });
  }

  await Subject.deleteMany(T(req, { classroom: classId }));

  res.json({ message: "Class deleted successfully" });
});

exports.addSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.create({ ...req.body, tenant: req.tenantId });
  res.status(201).json(subject);
});
