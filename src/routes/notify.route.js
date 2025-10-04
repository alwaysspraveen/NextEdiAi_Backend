const router = require("express").Router();
const { protect } = require("../middlewares/auth");
const c = require("../controllers/notify.controller");
router.use(protect);
router.post("/", c.sendNotification);
router.get("/:userId", c.getUserNotifications);
router.patch("/read/:id", c.markAsRead); // ✅ mark single notification
router.patch("/read-all/:userId", c.markAllAsRead); // ✅ mark all for user
router.post("/register-token", c.registerToken); // for FCM token registration
router.get("/unread-count/:userId", c.getUnreadCount); // ✅ get unread count
module.exports = router;
