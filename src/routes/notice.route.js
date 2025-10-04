const router = require('express').Router();
const { protect, permit } = require('../middlewares/auth');
const c = require('../controllers/notice.controller');
router.use(protect);
router.post('/', permit('PRINCIPAL'), c.create);
router.get('/', c.list);
module.exports = router;
