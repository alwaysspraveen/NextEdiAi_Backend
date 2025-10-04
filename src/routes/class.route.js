const router = require("express").Router();
const { protect, permit } = require("../middlewares/auth");
const c = require("../controllers/class.controller");
router.use(protect);
router.post("/", permit("PRINCIPAL"), c.createClass);
router.get("/", permit("PRINCIPAL", "TEACHER"), c.listClasses);
router.put("/:classId", permit("PRINCIPAL"), c.updateClass);
router.get("/by-teacher/:teacherId", protect, c.getClassByTeacher);
router.get("/by-classname/:className", protect, c.getClassesByName);
router.get("/:id", permit("PRINCIPAL", "TEACHER"), c.classDetail);
router.post("/add-student", permit("PRINCIPAL"), c.addStudent);
router.delete("/delete-class/:classId", permit("PRINCIPAL"), c.deleteClass);
router.post("/remove-student", permit("PRINCIPAL"), c.removeStudent);
router.post("/subjects", permit("PRINCIPAL"), c.addSubject);
module.exports = router;
    