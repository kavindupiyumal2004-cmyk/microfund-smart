const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const loanTypeValidation = require('../middleware/loanTypeValidation');

router.use(authenticate);

// Owner = read/monitor/report. Manager = day-to-day operational control.
router.get('/user-summary', authorize('OWNER', 'MANAGER'), controller.userSummary);
router.get('/users', authorize('OWNER', 'MANAGER'), controller.users);
router.get('/users/:id', authorize('OWNER', 'MANAGER'), controller.userDetails);
router.post('/users', authorize('MANAGER'), [
  body('full_name').trim().isLength({ min: 3, max: 120 }),
  body('email').isEmail(),
  body('password').isLength({ min: 8 }),
  body('role').isIn(['MANAGER', 'CASHIER', 'AGENT']),
  body('area_ids').optional().isArray(),
  body('branch_name').optional({ nullable: true }).isLength({ max: 120 }),
  body('max_pending_reviews').optional().isInt({ min: 1, max: 500 }),
], validate, controller.createStaff);
router.patch('/users/:id/status', authorize('MANAGER'), [body('is_active').isBoolean()], validate, controller.toggleUser);
router.put('/users/:id/areas', authorize('MANAGER'), [body('area_ids').isArray()], validate, controller.setAgentAreas);
router.patch('/users/:id/cashier-profile', authorize('MANAGER'), [
  body('branch_name').optional({ nullable: true }).isLength({ max: 120 }),
  body('is_available').optional().isBoolean(),
  body('max_pending_reviews').optional().isInt({ min: 1, max: 500 }),
], validate, controller.updateCashierProfile);
router.get('/cashiers', authorize('OWNER', 'MANAGER'), controller.cashiers);
router.get('/areas', authorize('OWNER', 'MANAGER'), controller.areas);
router.post('/areas', authorize('MANAGER'), [body('name').trim().notEmpty(), body('district').trim().notEmpty(), body('province').trim().notEmpty()], validate, controller.createArea);
router.put('/areas/:id', authorize('MANAGER'), controller.updateArea);
router.delete('/areas/:id', authorize('MANAGER'), controller.deleteArea);
router.get('/loan-types', authorize('OWNER', 'MANAGER'), controller.loanTypes);
router.post('/loan-types', authorize('MANAGER'), loanTypeValidation(), validate, controller.createLoanType);
router.put('/loan-types/:id', authorize('MANAGER'), loanTypeValidation(), validate, controller.updateLoanType);
router.delete('/loan-types/:id', authorize('MANAGER'), controller.deleteLoanType);
router.get('/audit-logs', authorize('OWNER', 'MANAGER'), controller.auditLogs);
module.exports = router;
