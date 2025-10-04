const mongoose = require("mongoose");
const AuditSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: String,
    entityType: String,
    entityId: String,
    meta: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);
module.exports = mongoose.model("Audit", AuditSchema);
