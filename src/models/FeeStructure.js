const mongoose = require("mongoose");
const FeeStructureSchema = new mongoose.Schema(
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
    },
    items: [{ name: String, amount: { type: Number, min: 0 } }],
    dueDate: Date,
  },
  { timestamps: true }
);
FeeStructureSchema.index({ tenant: 1, classroom: 1, createdAt: 1 });
module.exports = mongoose.model("FeeStructure", FeeStructureSchema);
