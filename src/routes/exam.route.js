const router = require('express').Router();
const { protect, permit } = require('../middlewares/auth');
const c = require('../controllers/exam.controller');
router.use(protect);
router.post('/', permit('PRINCIPAL','TEACHER'), c.createExam);
router.post('/marks-bulk', permit('PRINCIPAL','TEACHER'), c.enterMarksBulk);
router.get('/:examId/results', permit('PRINCIPAL','TEACHER'), c.classResults);
router.get('/report-card', permit('PRINCIPAL','TEACHER','STUDENT','PARENT'), c.reportCard);
module.exports = router;
