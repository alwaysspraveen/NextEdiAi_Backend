const express = require("express");
const router = express.Router();

const {
  createLeave,
  getLeavesByTeacher,
  getAllLeaves,
  cancelLeave,
  rejectLeave,
} = require("../controllers/leave.controller");
const {
  approveLeaveAndSchedule,
} = require("../controllers/substitutionAgent.controller");

// Teacher applies for leave
router.post("/", createLeave);

// Principal views all leaves

// Principal approves leave + auto substitution
router.post("/:id/approve", approveLeaveAndSchedule);
router.post("/:id/reject", rejectLeave);
router.post("/:id/cancel", cancelLeave);
router.get("/teacher/:teacherId", getLeavesByTeacher); // teacher leaves
router.get("/all", getAllLeaves); // principal leaves
module.exports = router;
