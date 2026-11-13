const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/fieldController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(authenticate, authorize('AGENT'));
router.get('/visits', controller.myVisits);
router.patch('/visits/:id/status', [body('status').isIn(['IN_PROGRESS', 'RESCHEDULED', 'CANCELLED']), body('scheduled_at').optional().isISO8601()], validate, controller.updateStatus);
router.post('/visits/:id/report', [
  body('recommendation').isIn(['APPROVE', 'REJECT', 'REVIEW_AGAIN']),
  body('comments').trim().isLength({ min: 10, max: 3000 }),
  body('residence_verified').optional().isBoolean(),
  body('income_verified').optional().isBoolean(),
  body('business_verified').optional().isBoolean(),
  body('documents_verified').optional().isBoolean(),
  body('guarantor_verified').optional().isBoolean(),
], validate, controller.submitReport);
module.exports = router;
