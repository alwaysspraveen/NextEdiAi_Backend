const mongoose = require("mongoose");
const ExamSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    classroom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Classroom",
      required: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    title: { type: String, required: true },
    date: { type: Date, required: true },
    maxMarks: { type: Number, default: 100 },
  },
  { timestamps: true }
);
ExamSchema.index(
  { tenant: 1, classroom: 1, subject: 1, title: 1 },
  { unique: true }
);
module.exports = mongoose.model("Exam", ExamSchema);
