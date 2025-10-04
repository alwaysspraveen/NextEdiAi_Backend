const router = require("express").Router();
const { login, changePassword } = require("../controllers/auth.controller");
const { protect } = require("../middlewares/auth");
router.post("/login", login); // body: {email, password, tenantId OR tenantCode}
router.post("/change-password", protect, changePassword);
module.exports = router;
