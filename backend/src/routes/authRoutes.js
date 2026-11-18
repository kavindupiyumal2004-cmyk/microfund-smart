const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/authController');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/register', [
  body('full_name').trim().isLength({ min: 3, max: 120 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8, max: 72 }).custom(value => Buffer.byteLength(value, 'utf8') <= 72).matches(/[A-Z]/).matches(/[a-z]/).matches(/[0-9]/),
  body('nic').trim().isLength({ min: 8, max: 20 }),
  body('phone').trim().isLength({ min: 9, max: 20 }),
  body('address_line1').trim().isLength({ min: 5, max: 255 }),
  body('city').trim().isLength({ min: 2, max: 100 }),
  body('area_id').isInt({ min: 1 }),
  body('monthly_income').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }),
], validate, controller.register);
router.post('/login', [body('email').isEmail(), body('password').notEmpty()], validate, controller.login);
const passwordLimiter = require('express-rate-limit')({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: { message: 'Too many password requests. Please try again in 15 minutes.' } } });
router.post('/change-password', authenticate, passwordLimiter, [body('current_password').isString().notEmpty(), body('password').isLength({ min: 8, max: 72 }).matches(/[A-Z]/).matches(/[a-z]/).matches(/[0-9]/).custom(value => Buffer.byteLength(value, 'utf8') <= 72)], validate, controller.changePassword);
router.post('/forgot-password', passwordLimiter, [body('email').isEmail()], validate, controller.forgotPassword);
router.post('/reset-password', passwordLimiter, [body('token').isLength({ min: 20 }), body('password').isLength({ min: 8, max: 72 }).custom(value => Buffer.byteLength(value, 'utf8') <= 72).matches(/[A-Z]/).matches(/[a-z]/).matches(/[0-9]/)], validate, controller.resetPassword);
router.get('/me', authenticate, controller.me);
router.get('/smtp-status', authenticate, authorize('MANAGER'), controller.smtpStatus);
module.exports = router;
