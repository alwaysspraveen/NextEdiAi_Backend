const mongoose = require('mongoose');

const TenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true }, // e.g. "greenvalley"
    domain: String, // optional: subdomain like greenvalley.campusflow.in
    academicYear: String,
    settings: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tenant', TenantSchema);
