const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/authController');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { customerDocuments } = require('../middleware/upload');

router.post('/register', customerDocuments.fields([
  { name: 'nic_front', maxCount: 1 },
  { name: 'nic_back', maxCount: 1 },
  { name: 'residence_proof', maxCount: 1 },
  { name: 'income_proof', maxCount: 1 },
]), [
  body('full_name').trim().isLength({ min: 3, max: 120 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/[A-Z]/).matches(/[a-z]/).matches(/[0-9]/),
  body('nic').trim().isLength({ min: 8, max: 20 }),
  body('phone').trim().isLength({ min: 9, max: 20 }),
  body('address_line1').trim().isLength({ min: 5, max: 255 }),
  body('city').trim().isLength({ min: 2, max: 100 }),
  body('area_id').isInt({ min: 1 }),
  body('monthly_income').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }),
], validate, controller.register);
router.post('/login', [body('email').isEmail(), body('password').notEmpty()], validate, controller.login);
router.post('/verify-email', [body('token').isLength({ min: 20 })], validate, controller.verifyEmail);
router.post('/resend-verification', [body('email').isEmail()], validate, controller.resendVerification);
router.post('/forgot-password', [body('email').isEmail()], validate, controller.forgotPassword);
router.post('/reset-password', [body('token').isLength({ min: 20 }), body('password').isLength({ min: 8 }).matches(/[A-Z]/).matches(/[a-z]/).matches(/[0-9]/)], validate, controller.resetPassword);
router.get('/me', authenticate, controller.me);
router.get('/smtp-status', authenticate, authorize('MANAGER'), controller.smtpStatus);
module.exports = router;
