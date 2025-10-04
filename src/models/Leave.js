const mongoose = require("mongoose");
const { Schema } = mongoose;

const PeriodSchema = new Schema({
  date: { type: Date, required: true },
  day: { type: String, required: true },
  periodKey: { type: String, required: true },
  subject: { type: Schema.Types.ObjectId, ref: "Subject" },
  classroomId: { type: Schema.Types.ObjectId, ref: "Classroom" },
});

const LeaveSchema = new Schema(
  {
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: [
        "CASUAL",
        "SICK",
        "EARNED",
        "OD",
        "COMP_OFF",
        "UNPAID",
        "MATERNITY",
        "PATERNITY",
      ],
    },
    startDate: Date,
    endDate: Date,
    approverId: { type: Schema.Types.ObjectId, ref: "User" },
    periods: [PeriodSchema], // ✅ correct
    reason: String,
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

LeaveSchema.index({ teacherId: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model("Leave", LeaveSchema);
