const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const ROLES = ["PRINCIPAL", "TEACHER", "STUDENT", "PARENT"];

const UserSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    fcmTokens: {
      type: [String],
      default: [],
    },

    // Basic Info (Common)
    name: { type: String, trim: true },
    fname: { type: String, required: true, trim: true },
    lname: { type: String, required: true, trim: true },
    mname: { type: String, trim: true },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String },
    address: { type: String },
    role: { type: String, enum: ROLES, required: true },
    idCardNo: { type: String, unique: true, sparse: true },
    password: { type: String, required: true, minlength: 6, select: false },

    // Student-Specific Fields
    admissionNo: { type: String, unique: true, sparse: true },
    category: { type: String },
    religion: { type: String },
    emergencyContact: { type: String },
    rollNo: { type: String },
    class: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom" }, // Linked to Class collection
    section: { type: String }, // Optional fallback if no Class model
    dob: { type: Date },
    gender: { type: String, enum: ["Male", "Female", "Other"] },
    bloodGroup: { type: String },
    enrollmentDate: { type: Date },

    singleParent: { type: Boolean, default: false },
    guardianName: { type: String },
    guardianAddress: { type: String },
    guardianState: { type: String },
    guardianCity: { type: String },
    guardianZip: { type: Number },
    guardianCountry: { type: String },
    guardianPhone: { type: String },
    guardianEmail: { type: String },
    guardianRelation: { type: String, enum: ["Father", "Mother", "Guardian"] }, // e.g., Father, Mother, Guardian

    // Teacher-Specific Fields
    teacherSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }],
    employeeCode: { type: String, unique: true, sparse: true },
    joiningDate: { type: Date },
    qualification: { type: String },
    experience: { type: Number },
    maxPerDay: { type: Number, default: 6 },
    maxPerWeek: { type: Number, default: 30 },

    // Parent-Specific Fields
    parentOf: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Linked Students

    // Status & Profile
    isActive: { type: Boolean, default: true },
    profileImage: { type: String },
  },
  { timestamps: true }
);

// Email must be unique per tenant
UserSchema.index({ tenant: 1, email: 1 }, { unique: true });

// Password Hashing Middleware
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare Password
UserSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", UserSchema);
module.exports.ROLES = ROLES;
