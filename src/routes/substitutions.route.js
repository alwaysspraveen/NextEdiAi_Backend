const express = require("express");
const router = express.Router();
const {
  listSubstitutions,
} = require("../controllers/substitutionAgent.controller");

// GET /api/substitutions?classroomId=...&from=...&to=...
router.get("/", listSubstitutions);

module.exports = router;
