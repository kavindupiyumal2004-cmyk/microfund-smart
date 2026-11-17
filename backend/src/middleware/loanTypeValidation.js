const { body } = require('express-validator');

module.exports = () => [
  body('name').trim().isLength({ min: 1, max: 120 }),
  body('description').optional({ nullable: true }).isString(),
  body('min_amount').isFloat({ min: 1, max: 999999999999.99 }),
  body('max_amount').isFloat({ min: 1, max: 999999999999.99 }).bail().custom((value, { req }) => Number(value) >= Number(req.body.min_amount)).withMessage('Maximum amount must be at least the minimum amount.'),
  body('annual_interest_rate').isFloat({ min: 0, max: 9999.99 }),
  body('duration_months').isInt({ min: 1, max: 4294967295 }),
  body('is_active').optional().isBoolean(),
];
