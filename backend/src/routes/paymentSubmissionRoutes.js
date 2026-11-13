const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/paymentSubmissionController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { paymentSlips } = require('../middleware/upload');

router.use(authenticate);
router.post('/', authorize('CUSTOMER'), paymentSlips.single('slip'), [
  body('loan_id').isInt({ min: 1 }),
  body('installment_id').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('amount').isFloat({ min: 0.01 }),
  body('payment_date').isISO8601(),
  body('bank_name').trim().isLength({ min: 2, max: 120 }),
  body('reference_no').trim().isLength({ min: 2, max: 120 }),
  body('customer_note').optional({ checkFalsy: true }).isLength({ max: 1500 }),
], validate, controller.create);
router.get('/mine', authorize('CUSTOMER'), controller.mine);
router.get('/', authorize('OWNER', 'CASHIER', 'MANAGER'), controller.list);
router.get('/:id', controller.getOne);
router.patch('/:id/start', authorize('CASHIER', 'MANAGER'), controller.startReview);
router.post('/:id/decision', authorize('CASHIER', 'MANAGER'), [body('decision').isIn(['ACCEPT', 'REJECT', 'CLARIFY']), body('note').optional({ nullable: true }).isLength({ max: 1500 })], validate, controller.decision);
router.post('/:id/messages', [body('message').trim().isLength({ min: 2, max: 1500 })], validate, controller.addMessage);
router.post('/:id/reassign', authorize('MANAGER'), [body('cashier_id').optional({ nullable: true }).isInt({ min: 1 }), body('note').optional({ nullable: true }).isLength({ max: 1000 })], validate, controller.reassign);
module.exports = router;
