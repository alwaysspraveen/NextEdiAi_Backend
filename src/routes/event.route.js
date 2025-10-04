const router = require("express").Router();

// replace with your real auth
const { protect, permit } = require("../middlewares/auth");
const c = require("../controllers/event.controller");
router.use(protect);

router.get("/", c.listEvents);
router.post("/", c.createEvent);
router.patch("/:id", c.updateEvent);
router.delete("/:id", c.deleteEvent);

router.post("/availability", c.availability);

module.exports = router;
