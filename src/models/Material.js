const mongoose = require("mongoose");

const MaterialSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Classroom",
      required: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    materialId: { type: String, required: true },
    type: {
      type: String,
      enum: ["PDF", "VIDEO", "LINK", "DOC"],
      default: "PDF",
    },
    url: { type: String },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Material", MaterialSchema);
