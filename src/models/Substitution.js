const mongoose = require("mongoose");
const { Schema } = mongoose;

const SubstitutionSchema = new Schema(
  {
    date: { type: Date, required: true, index: true }, // actual calendar date
    classroomId: {
      type: Schema.Types.ObjectId,
      ref: "Classroom",
      required: true,
      index: true,
    },
    periodKey: { type: String, required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject" }, // optional override
    absentTeacherId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    substituteTeacherId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    mode: {
      type: String,
      enum: ["SUBJECT", "ALT_SUBJECT", "SUPERVISION"],
      default: "SUBJECT",
    },
    note: String,
  },
  { timestamps: true }
);

SubstitutionSchema.index(
  { date: 1, classroomId: 1, periodKey: 1 },
  { unique: true }
);

module.exports = mongoose.model("Substitution", SubstitutionSchema);
