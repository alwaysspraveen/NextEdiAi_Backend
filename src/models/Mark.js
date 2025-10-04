const mongoose = require("mongoose");
const MarkSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    score: { type: Number, required: true },
    grade: String,
  },
  { timestamps: true }
);
MarkSchema.index({ tenant: 1, exam: 1, student: 1 }, { unique: true });
module.exports = mongoose.model("Mark", MarkSchema);
