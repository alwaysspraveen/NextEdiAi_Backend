const mongoose = require("mongoose");
const SubjectSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    code: { type: String, required: true },
    classroom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Classroom",
      required: true,
    },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    academicYear: { type: String, required: true },
  },
  { timestamps: true }
);
SubjectSchema.index({ tenant: 1, code: 1, classroom: 1 }, { unique: true });
module.exports = mongoose.model("Subject", SubjectSchema);
