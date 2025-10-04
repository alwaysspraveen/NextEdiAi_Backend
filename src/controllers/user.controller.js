const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User");
const Classroom = require("../models/Classroom");
const { T } = require("../utils/tenant");
const mongoose = require("mongoose");

exports.createUser = asyncHandler(async (req, res) => {
  const data = { ...req.body, tenant: req.user.tenant };
  const user = await User.create(data);
  res.status(201).json(user);
});

// controllers/user.controller.js
exports.listParents = asyncHandler(async (req, res) => {
  const { classId, section } = req.query;

  // Build filter dynamically
  const filter = { role: "PARENT" };

  if (classId) {
    filter["parentOf.class"] = classId;
  }
  if (section) {
    filter["parentOf.section"] = section;
  }

  const parents = await User.find(filter)
    .populate("parentOf.class", "name") // Fetch class name
    .sort({ createdAt: -1 })
    .lean();

  res.json(parents);
});

exports.listStudents = asyncHandler(async (req, res) => {
  const { classId, section } = req.query;

  // Build dynamic filter
  const filter = { role: "STUDENT" };

  if (classId && mongoose.Types.ObjectId.isValid(classId)) {
    filter.class = new mongoose.Types.ObjectId(classId);
  }

  if (section) {
    filter.section = section;
  }

  const students = await User.find(filter)
    .populate("class", "name") // Populate class name
    .sort({ createdAt: -1 })
    .lean();

  res.json(students);
});

exports.listStudentByClass = asyncHandler(async (req, res) => {
  const { classId } = req.params;

  if (!classId) {
    return res.status(400).json({ error: "Class ID is required." });
  }

  const filter = {
    role: "STUDENT",
    class: classId, // ✅ Correct field to match students in this class
    ...T(req), // ✅ Include multi-tenant filter if you're using it
  };

  const students = await User.find(filter)
    .populate("class", "name section academicYear") // or "class", depending on your schema
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({
    count: students.length,
    classId,
    students,
  });
});

exports.listUsers = asyncHandler(async (req, res) => {
  const q = T(req, req.query.role ? { role: req.query.role } : {});

  const users = await User.find(q)
    .sort({ createdAt: -1 })
    .populate("class", "name section academicYear") // ✅ Now works with Classroom
    .lean();

  res.json(users);
});

exports.updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = { ...req.body };
  if (data.password) delete data.password;
  const user = await User.findOneAndUpdate(T(req, { _id: id }), data, {
    new: true,
  });
  res.json(user);
});

exports.deleteUser = asyncHandler(async (req, res) => {
  await User.findOneAndDelete(T(req, { _id: req.params.id }));
  res.json({ ok: true });
});

exports.linkParent = asyncHandler(async (req, res) => {
  const { parentId, studentId } = req.body;
  const parent = await User.findOne(T(req, { _id: parentId }));
  const student = await User.findOne(T(req, { _id: studentId }));
  if (!parent || !student)
    throw Object.assign(new Error("Invalid parent or student"), {
      status: 400,
    });
  if (parent.role !== "PARENT" || student.role !== "STUDENT")
    throw Object.assign(new Error("Role mismatch"), { status: 400 });

  parent.parentOf = parent.parentOf || [];
  if (!parent.parentOf.find((id) => id.toString() === studentId))
    parent.parentOf.push(studentId);
  student.guardian = parentId;
  await parent.save();
  await student.save();
  res.json({ ok: true });
});
