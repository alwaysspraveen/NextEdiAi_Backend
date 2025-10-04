const asyncHandler = require("../utils/asyncHandler");
const FeeStructure = require("../models/FeeStructure");
const Invoice = require("../models/Invoice");
const Classroom = require("../models/Classroom");
const { T } = require("../utils/tenant");

exports.createStructure = asyncHandler(async (req, res) => {
  const doc = await FeeStructure.create({ ...req.body, tenant: req.tenantId });
  res.status(201).json(doc);
});

exports.generateInvoicesForClass = asyncHandler(async (req, res) => {
  const { classroomId } = req.body;
  const fs = await FeeStructure.findOne(
    T(req, { classroom: classroomId })
  ).sort({ createdAt: -1 });
  if (!fs)
    throw Object.assign(new Error("Fee structure not found"), { status: 404 });
  const cls = await Classroom.findOne(T(req, { _id: classroomId })).populate(
    "students",
    "_id"
  );
  const total = (fs.items || []).reduce((a, i) => a + (i.amount || 0), 0);
  const ops = cls.students.map((s) => ({
    updateOne: {
      filter: T(req, { student: s._id, dueDate: fs.dueDate }),
      update: {
        tenant: req.tenantId,
        student: s._id,
        classroom: classroomId,
        items: fs.items,
        total,
        status: "PENDING",
        dueDate: fs.dueDate,
      },
      upsert: true,
    },
  }));
  await Invoice.bulkWrite(ops);
  res.json({ ok: true, total, count: cls.students.length });
});

exports.collectPayment = asyncHandler(async (req, res) => {
  const { invoiceId, amount, method, txnId } = req.body;
  const inv = await Invoice.findOne(T(req, { _id: invoiceId }));
  if (!inv)
    throw Object.assign(new Error("Invoice not found"), { status: 404 });
  inv.payments.push({ amount, method, txnId });
  const paid = inv.payments.reduce((a, p) => a + p.amount, 0);
  inv.status = paid >= inv.total ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING";
  await inv.save();
  res.json(inv);
});

exports.pendingDues = asyncHandler(async (req, res) => {
  const q = T(req, { status: { $ne: "PAID" } });
  if (req.query.classroomId) q.classroom = req.query.classroomId;
  res.json(await Invoice.find(q).populate("student", "name email"));
});
