const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const router = express.Router();
const controller = require("../controllers/attendance.controller");
const { protect, permit } = require("../middlewares/auth");

// Custom validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(422).json({ errors: errors.array() });
};

router.use(protect);

/** 🚀 Mark or upsert attendance */
router.post(
  "/",
  permit("PRINCIPAL", "TEACHER"),
  body("classId").isMongoId().withMessage("Invalid classId"),
  body("date").isISO8601().withMessage("Invalid date"),
  body("records")
    .isArray({ min: 1 })
    .withMessage("Records must be a non-empty array"),
  body("records.*.student")
    .isMongoId()
    .withMessage("Each record must have valid student ID"),
  body("records.*.status")
    .isIn(["P", "A", "L"])
    .withMessage("Status must be P, A or L"),
  body("records.*.note").optional().isString(),
  validate,
  controller.markAttendance
);

/** 📅 Get attendance by class and date */
router.get(
  "/:classId/:date",
  permit("PRINCIPAL", "TEACHER"),
  param("classId").isMongoId().withMessage("Invalid class ID"),
  param("date").isISO8601().withMessage("Invalid date"),
  validate,
  controller.getAttendanceByClassDate
);

router.get("/:studentId", controller.getStudentAttendance);

/** 📊 Daily summary for a class */
router.get("/classwise-summary", controller.classwiseSummaryDaily);

/** 📆 Student monthly attendance summary */
router.get(
  "/students-monthly/:classId/:year/:month",
  permit("PRINCIPAL", "TEACHER", "STUDENT", "PARENT"),
  controller.studentsMonthly
);

module.exports = router;
