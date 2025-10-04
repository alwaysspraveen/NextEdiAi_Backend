const asyncHandler = require('../utils/asyncHandler');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const { T } = require('../utils/tenant');

exports.create = asyncHandler(async (req, res) => {
  const doc = await Assignment.create({ ...req.body, tenant: req.tenantId, createdBy: req.user._id });
  res.status(201).json(doc);
});

exports.list = asyncHandler(async (req, res) => {
  const q = T(req, {});
  if (req.query.classroom) q.classroom = req.query.classroom;
  if (req.query.subject) q.subject = req.query.subject;
  const list = await Assignment.find(q).sort({ createdAt: -1 });
  res.json(list);
});

exports.submit = asyncHandler(async (req, res) => {
  const body = { assignment: req.body.assignment, student: req.user._id, text: req.body.text, files: req.body.files || [] };
  const sub = await Submission.findOneAndUpdate(
    T(req, { assignment: body.assignment, student: body.student }),
    { ...body, tenant: req.tenantId },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.json(sub);
});

exports.grade = asyncHandler(async (req, res) => {
  const { submissionId, score, feedback } = req.body;
  const sub = await Submission.findOneAndUpdate(
    T(req, { _id: submissionId }),
    { score, feedback, gradedBy: req.user._id },
    { new: true }
  );
  res.json(sub);
});
