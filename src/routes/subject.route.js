const router = require("express").Router();
const subjectController = require("../controllers/subject.controller");
const { protect, permit } = require("../middlewares/auth");

// All routes protected
router.use(protect);

// POST /api/subjects - Create a new subject
router.post("/", subjectController.createSubject);

// GET /api/subjects - List all subjects (with optional ?classroom= & ?teacher=)
router.get("/", subjectController.listSubjects);

// PUT /api/subjects/assign - Assign teacher to subject
router.put("/assign", subjectController.assignTeacher);

router.get("/by-class/:classId", subjectController.getSubjectsByClass);

router.get(
  "/by-class/:classId/teacher/:teacherId",
  subjectController.getSubjectsByClassAndTeacher
);
router.get(
  "/teacher/:teacherId",
  subjectController.getSubjectsByClassAndTeacher
);

// Query-style (classId optional): /api/subjects?teacherId=...&classId=...
router.get("/", subjectController.getSubjectsByClassAndTeacher);
// PUT /api/subjects/:id - Update a subject
router.put("/:id", subjectController.updateSubject);

// DELETE /api/subjects/:id - Delete a subject
router.delete("/:id", subjectController.removeSubject);

module.exports = router;
