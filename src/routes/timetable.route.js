const express = require("express");
const router = express.Router();
const controller = require("../controllers/timetable.controller");
const { protect, permit } = require("../middlewares/auth");

router.use(protect);
router.get("/", /*auth,*/ controller.getTimetable);
router.post("/generate", /*auth,*/ controller.generateTimetable);
router.post("/validate", /*auth,*/ controller.validateTimetable);
router.post("/publish", /*auth,*/ controller.publishTimetable);
router.post("/auto-substitute", controller.autoAssignSubstitute);
router.get("/get-timetable/:teacherId", controller.getTimetableByTeacher);
router.get("/get-timetable/:teacherId/:day", controller.getTimetableByTeacherByDay);
module.exports = router;
