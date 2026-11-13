const router = require('express').Router();
const { body, query } = require('express-validator');
const controller = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(authenticate);
router.get('/search', authorize('OWNER', 'CASHIER', 'MANAGER'), [query('query').trim().notEmpty()], validate, controller.searchLoans);
router.get('/loan-detail/:id', authorize('OWNER', 'MANAGER', 'CASHIER', 'CUSTOMER'), controller.getLoan);
router.post('/', authorize('CASHIER', 'MANAGER'), [body('loan_id').isInt({ min: 1 }), body('amount').isFloat({ min: 0.01 }), body('method').isIn(['CASH', 'BANK_TRANSFER', 'CARD', 'OTHER']), body('paid_at').optional().isISO8601()], validate, controller.record);
router.get('/loan/:loanId', authorize('OWNER', 'MANAGER', 'CASHIER', 'CUSTOMER'), controller.history);
module.exports = router;
