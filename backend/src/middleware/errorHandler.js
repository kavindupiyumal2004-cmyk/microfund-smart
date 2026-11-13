const multer = require('multer');
const { ValidationError, UniqueConstraintError } = require('sequelize');
const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'SERVER_ERROR', details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function notFound(req, _res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

function errorHandler(err, req, res, _next) {
  let status = err.statusCode || 500;
  let code = err.code || 'SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred.';
  let details = err.details;

  if (err instanceof UniqueConstraintError) {
    status = 409; code = 'DUPLICATE_VALUE'; message = 'A record with the same value already exists.';
    details = err.errors.map((e) => ({ field: e.path, message: e.message }));
  } else if (err instanceof ValidationError) {
    status = 422; code = 'DATABASE_VALIDATION_ERROR'; message = 'Database validation failed.';
    details = err.errors.map((e) => ({ field: e.path, message: e.message }));
  } else if (err instanceof multer.MulterError) {
    status = 400; code = 'UPLOAD_ERROR'; message = err.message;
  }

  logger.error(message, { error: err.stack, path: req.originalUrl, method: req.method, userId: req.user?.id });
  res.status(status).json({ success: false, error: { code, message, details } });
}

module.exports = { AppError, notFound, errorHandler };
