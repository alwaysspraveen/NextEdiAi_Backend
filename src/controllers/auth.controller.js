const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User");
const Tenant = require("../models/Tenant");

const sign = (user, tenant) =>
  jwt.sign(
    {
      id: user._id,
      name: user.name,
      fname: user.fname, // ✅ Include name here
      email: user.email, // ✅ Also include email for easy access
      role: user.role,
      tenant: {
        id: tenant._id,
        code: tenant.code,
        name: tenant.name,
      },
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // ✅ Explicitly include password
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  // ✅ Compare password properly
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  // ✅ Get tenant details
  const tenant = await Tenant.findById(user.tenant);
  if (!tenant) {
    return res.status(400).json({ message: "Tenant not found" });
  }

  // ✅ Generate JWT
  const token = sign(user, tenant);

  res.status(200).json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      fname: user.fname,
    },
    tenant: {
      id: tenant._id,
      code: tenant.code,
      name: tenant.name,
    },
  });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body || {};
  if (!currentPassword || !newPassword || !confirmPassword)
    return res.status(400).json({ message: "All fields are required." });
  if (newPassword !== confirmPassword)
    return res.status(400).json({ message: "New passwords do not match." });

  const email = req.user?.email;
  const user = await User.findOne({ email }).select("+password");
  if (!user || !user.password)
    return res.status(404).json({ message: "User not found." });

  const ok = await bcrypt.compare(
    String(currentPassword),
    String(user.password)
  );
  if (!ok)
    return res.status(401).json({ message: "Incorrect current password." });

  // ⬇️ Assign plain; pre-save hook will hash
  user.password = String(newPassword);
  await user.save();

  res.status(200).json({ message: "Password changed successfully!" });
});
