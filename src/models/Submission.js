const mongoose = require("mongoose");
const SubmissionSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: String,
    files: [String],
    score: Number,
    feedback: String,
    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
SubmissionSchema.index(
  { tenant: 1, assignment: 1, student: 1 },
  { unique: true }
);
module.exports = mongoose.model("Submission", SubmissionSchema);
