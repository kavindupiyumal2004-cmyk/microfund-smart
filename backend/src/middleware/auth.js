const jwt = require('jsonwebtoken');
const { User, Role } = require('../models');
const { AppError } = require('./errorHandler');
const asyncHandler = require('../utils/asyncHandler');

const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AppError('Authentication is required.', 401, 'UNAUTHENTICATED');
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); } catch (_error) {
    throw new AppError('Your session has expired or is invalid.', 401, 'INVALID_TOKEN');
  }
  const user = await User.findByPk(payload.sub, { include: Role });
  if (!user || !user.is_active) throw new AppError('This account is unavailable.', 401, 'ACCOUNT_DISABLED');
  req.user = user;
  next();
});

const authorize = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.Role.name)) return next(new AppError('You do not have permission to perform this action.', 403, 'FORBIDDEN'));
  return next();
};

module.exports = { authenticate, authorize };
