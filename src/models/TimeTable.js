const mongoose = require("mongoose");

const TTEntrySchema = new mongoose.Schema(
  {
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Classroom",
      index: true,
    },
    day: {
      type: String,
      required: true,
      enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    },
    periodKey: { type: String, required: true }, // 'P1' | 'BREAK' | ...
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject" },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    absentTeacher: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // 👈 Add this
    roomId: { type: String },
    isBreak: { type: Boolean, default: false },
    isSubstitution: { type: Boolean, default: false },
  },
  { _id: false }
);

const TimeTableSchema = new mongoose.Schema(
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
      index: true,
    },
    weekStart: { type: Date, required: true, index: true },
    weekKey: { type: String, required: true }, // <-- add this
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    entries: [TTEntrySchema],
  },
  { timestamps: true }
);
TimeTableSchema.index(
  { tenant: 1, classroom: 1, weekStart: 1 },
  { unique: true }
);

module.exports = mongoose.model("TimeTable", TimeTableSchema);
