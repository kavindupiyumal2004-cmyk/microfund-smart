const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/collectionController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(authenticate, authorize('OWNER', 'MANAGER', 'AGENT'));
router.get('/summary', controller.summary);
router.get('/agents', authorize('OWNER', 'MANAGER'), controller.agents);
router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.patch('/:id/assign', authorize('MANAGER'), [
  body('agent_id').isInt({ min: 1 }),
  body('next_followup_date').optional({ checkFalsy: true }).isISO8601(),
  body('manager_note').optional({ nullable: true }).isLength({ max: 1500 }),
], validate, controller.assign);
router.post('/:id/activities', authorize('MANAGER', 'AGENT'), [
  body('action_type').isIn(['CALL', 'SMS', 'FIELD_VISIT', 'NOTE', 'PROMISE', 'ESCALATION']),
  body('note').trim().isLength({ min: 2, max: 3000 }),
  body('promise_amount').optional({ checkFalsy: true }).isFloat({ min: 0.01 }),
  body('promise_date').optional({ checkFalsy: true }).isISO8601(),
  body('next_followup_date').optional({ checkFalsy: true }).isISO8601(),
], validate, controller.addActivity);
router.post('/:id/resolve', authorize('MANAGER'), [body('note').optional({ checkFalsy: true }).isLength({ max: 1500 })], validate, controller.resolve);

module.exports = router;
