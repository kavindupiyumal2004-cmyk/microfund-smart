const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/applicationController');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.post('/', authorize('CUSTOMER'), [
  body('loan_type_id').isInt({ min: 1 }), body('area_id').isInt({ min: 1 }),
  body('requested_frequency').optional().isIn(['WEEKLY', 'MONTHLY']),
  body('requested_duration_months').optional().isInt({ min: 1, max: 120 }),
  body('requested_amount').isFloat({ min: 1 }), body('monthly_income').isFloat({ min: 1 }),
  body('purpose').trim().isLength({ min: 10, max: 2000 }),
], validate, controller.create);
router.get('/mine', authorize('CUSTOMER'), controller.mine);
router.get('/my-loans', authorize('CUSTOMER'), controller.myLoans);
router.get('/', authorize('OWNER', 'MANAGER'), controller.list);
router.get('/:id', authorize('OWNER', 'MANAGER', 'AGENT', 'CUSTOMER'), controller.getOne);
router.get('/:id/recommend-agents', authorize('MANAGER'), controller.recommendAgents);
router.post('/:id/assign', authorize('MANAGER'), [
  body('agent_id').isInt({ min: 1 }), body('scheduled_at').isISO8601(),
  body('priority').optional().isIn(['LOW', 'NORMAL', 'HIGH']),
  body('admin_instructions').optional({ nullable: true }).isLength({ max: 1500 }),
], validate, controller.assignAgent);
router.get('/:id/assessment', authorize('OWNER', 'MANAGER'), controller.getAssessment);
router.put('/:id/assessment', authorize('MANAGER'), [
  body('household_expenses').isFloat({ min: 0 }),
  body('existing_loan_payments').isFloat({ min: 0 }),
  body('other_commitments').isFloat({ min: 0 }),
  body('proposed_amount').isFloat({ min: 1 }),
  body('proposed_interest_rate').isFloat({ min: 0 }),
  body('proposed_duration_months').isInt({ min: 1, max: 120 }),
  body('risk_level').isIn(['LOW', 'MEDIUM', 'HIGH']),
  body('recommendation').isIn(['APPROVE', 'REVIEW', 'REJECT']),
  body('notes').optional({ nullable: true }).isLength({ max: 3000 }),
], validate, controller.saveAssessment);
router.post('/:id/approve', authorize('MANAGER'), [
  body('approved_amount').isFloat({ min: 1 }), body('interest_rate').isFloat({ min: 0 }),
  body('duration_months').isInt({ min: 1, max: 120 }), body('start_date').isISO8601(),
  body('admin_note').optional({ nullable: true }).isLength({ max: 1500 }),
], validate, controller.approve);
router.post('/:id/reject', authorize('MANAGER'), [
  body('reason').trim().isLength({ min: 5, max: 1000 }),
  body('admin_note').optional({ nullable: true }).isLength({ max: 1500 }),
], validate, controller.reject);
module.exports = router;
