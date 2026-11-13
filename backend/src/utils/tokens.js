const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const createJwt = (user) => jwt.sign(
  { sub: user.id, role: user.Role?.name || user.role_name },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '1d' },
);

const createOpaqueToken = () => {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
};

const hashOpaqueToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

module.exports = { createJwt, createOpaqueToken, hashOpaqueToken };
