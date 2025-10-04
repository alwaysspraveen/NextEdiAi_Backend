const mongoose = require("mongoose");
const PaymentSchema = new mongoose.Schema(
  {
    amount: Number,
    method: { type: String, enum: ["CASH", "ONLINE", "BANK"] },
    date: { type: Date, default: Date.now },
    txnId: String,
  },
  { _id: false }
);

const InvoiceSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    classroom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Classroom",
      required: true,
    },
    items: [{ name: String, amount: Number }],
    total: Number,
    status: {
      type: String,
      enum: ["PENDING", "PARTIAL", "PAID"],
      default: "PENDING",
    },
    payments: [PaymentSchema],
    dueDate: Date,
  },
  { timestamps: true }
);

InvoiceSchema.index({ tenant: 1, student: 1, dueDate: 1 });
module.exports = mongoose.model("Invoice", InvoiceSchema);
