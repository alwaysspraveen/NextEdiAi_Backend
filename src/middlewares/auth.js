const jwt = require("jsonwebtoken");
const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User");

const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.split(" ")[1] : null;
  if (!token) throw Object.assign(new Error("Unauthorized"), { status: 401 });

  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(payload.id);
  if (!user) throw Object.assign(new Error("User not found"), { status: 401 });

  req.user = user;
  req.tenantId = user.tenant?._id || user.tenant; // ← main fix
  next();
});

const permit =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role))
      return next(Object.assign(new Error("Forbidden"), { status: 403 }));
    next();
  };

module.exports = { protect, permit };
  