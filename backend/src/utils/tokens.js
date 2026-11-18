const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const credentialVersion = (user) => crypto.createHmac('sha256', process.env.JWT_SECRET).update(user.password_hash || '').digest('hex');

const createJwt = (user) => jwt.sign(
  { sub: user.id, role: user.Role?.name || user.role_name, credential: credentialVersion(user) },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '1d' },
);

const createOpaqueToken = () => {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
};

const hashOpaqueToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

module.exports = { credentialVersion, createJwt, createOpaqueToken, hashOpaqueToken };
