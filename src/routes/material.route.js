const router = require("express").Router();
const { protect, permit } = require("../middlewares/auth");
const c = require("../controllers/material.controller");

router.use(protect);

// Create material
router.post("/", permit("PRINCIPAL", "TEACHER"), c.create);

// Get materials by classId + subjectId
router.get("/:classId/:subjectId", permit("PRINCIPAL", "TEACHER"), c.list);

module.exports = router;
