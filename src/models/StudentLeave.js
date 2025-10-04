// models/Leave.js
const mongoose = require('mongoose');

const LeaveSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  reason: { type: String },
});

module.exports = mongoose.model('StudentLeave', LeaveSchema);
