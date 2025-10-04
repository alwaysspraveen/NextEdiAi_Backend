const router = require('express').Router();
const { protect, permit } = require('../middlewares/auth');
const c = require('../controllers/fee.controller');
router.use(protect);
router.post('/structure', permit('PRINCIPAL'), c.createStructure);
router.post('/generate-invoices', permit('PRINCIPAL'), c.generateInvoicesForClass);
router.post('/collect', permit('PRINCIPAL'), c.collectPayment);
router.get('/pending', permit('PRINCIPAL'), c.pendingDues);
module.exports = router;
