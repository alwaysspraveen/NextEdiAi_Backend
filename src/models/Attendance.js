const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  records: [
    {
      student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      status: {
        type: String,
        enum: ["P", "A", "L"],
        default: "P",
      },
      note: String,
    },
  ],
});
module.exports = mongoose.model("Attendance", attendanceSchema);