const router = require("express").Router();
const { protect, permit } = require("../middlewares/auth");
const c = require("../controllers/assignment.controller");
router.use(protect);
router.post("/", permit("PRINCIPAL", "TEACHER"), c.create);
router.get("/", permit("PRINCIPAL", "TEACHER", "STUDENT"), c.list);
router.post("/submit", permit("STUDENT"), c.submit);
router.post("/grade", permit("PRINCIPAL", "TEACHER"), c.grade);
module.exports = router;
