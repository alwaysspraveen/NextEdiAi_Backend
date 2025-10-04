const mongoose = require("mongoose");
const ClassroomSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    section: { type: String, default: "A" },
    academicYear: { type: String, required: true },
    classTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }],
  },
  { timestamps: true }
);

ClassroomSchema.index(
  { tenant: 1, name: 1, section: 1, academicYear: 1 },
  { unique: true }
);
module.exports = mongoose.model("Classroom", ClassroomSchema);
