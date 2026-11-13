const { validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');

module.exports = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Please correct the highlighted fields.', 422, 'VALIDATION_ERROR', errors.array()));
  }
  return next();
};
