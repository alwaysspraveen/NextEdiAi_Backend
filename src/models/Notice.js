const mongoose = require("mongoose");
const NoticeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    audience: [
      {
        type: String,
        enum: ["PRINCIPAL", "TEACHER", "STUDENT", "PARENT", "ALL"],
      },
    ],
    classroom: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom" },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    publishAt: { type: Date, default: Date.now },
    expiresAt: Date,
  },
  { timestamps: true }
);
module.exports = mongoose.model("Notice", NoticeSchema);
