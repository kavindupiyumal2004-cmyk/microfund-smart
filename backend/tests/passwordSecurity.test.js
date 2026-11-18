const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const jwt = require('jsonwebtoken');
const { createJwt, credentialVersion } = require('../src/utils/tokens');

function fixture({ wrong = false, expired = false, disabled = false, missing = false, mailFailure = false } = {}) {
  const state = { hash: 'old-hash', used: false, sent: 0, disconnected: false, deleted: false };
  const user = { id: 7, email: 'test@example.com', full_name: 'Test', is_active: !disabled,
    get password_hash() { return state.hash; }, update: async (values) => { state.hash = values.password_hash; } };
  const token = { id: 1, user_id: 7 };
  const models = {
    User: { findByPk: async () => user, findOne: async () => missing ? null : user,
      sequelize: { transaction: async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }) } },
    EmailToken: {
      findOne: async ({ where }) => where.id ? (state.used || expired ? null : token) : token,
      update: async () => { state.used = true; },
      destroy: async () => { state.deleted = true; }, create: async () => {},
    },
  };
  const mocks = {
    bcryptjs: { compare: async (password) => password === 'old-password' && !wrong, hash: async () => 'new-hash' },
    dayjs: () => ({ add: () => ({ toDate: () => new Date() }) }),
    sequelize: { Op: { gt: Symbol('gt') } }, '../models': models,
    '../utils/asyncHandler': (fn) => fn,
    '../middleware/errorHandler': { AppError: class extends Error {} },
    '../utils/tokens': { hashOpaqueToken: (value) => value, createOpaqueToken: () => ({ raw: 'raw-token', hash: 'hash-token' }) },
    '../services/emailService': { mailConfigured: () => true, resetTemplate: () => ({}), sendMail: async () => { if (mailFailure) throw new Error('private provider details'); state.sent++; } },
    '../services/auditService': { audit: async () => {} }, '../utils/logger': { error: () => {} },
  };
  const exported = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/authController.js'), 'utf8'), {
    exports: exported, require: (name) => { if (!(name in mocks)) throw new Error(name); return mocks[name]; }, process: { env: { FRONTEND_URL: 'https://example.com' } },
  });
  const req = { user, body: { current_password: 'old-password', password: 'NewPassword123', token: 'raw-token', email: user.email }, app: { get: () => ({ in: () => ({ disconnectSockets: () => { state.disconnected = true; } }) }) } };
  let response;
  const res = { json: (data) => { response = data; } };
  return { controller: exported, req, res, state, response: () => response };
}

test('changing password invalidates reset links and disconnects sessions', async () => {
  const f = fixture(); await f.controller.changePassword(f.req, f.res);
  assert.equal(f.state.hash, 'new-hash'); assert.equal(f.state.used, true); assert.equal(f.state.disconnected, true);
});
test('wrong current password cannot change credentials', async () => {
  const f = fixture({ wrong: true }); await assert.rejects(f.controller.changePassword(f.req, f.res), /Current password/);
  assert.equal(f.state.hash, 'old-hash'); assert.equal(f.state.used, false);
});
test('reusing the current password is rejected', async () => {
  const f = fixture(); f.req.body.password = 'old-password';
  await assert.rejects(f.controller.changePassword(f.req, f.res), /different/);
});
test('reset links are single use', async () => {
  const f = fixture(); await f.controller.resetPassword(f.req, f.res);
  await assert.rejects(f.controller.resetPassword(f.req, f.res), /invalid or has expired/);
  assert.equal(f.state.hash, 'new-hash');
});
test('expired links and disabled accounts cannot reset passwords', async () => {
  for (const options of [{ expired: true }, { disabled: true }]) {
    const f = fixture(options); await assert.rejects(f.controller.resetPassword(f.req, f.res), /invalid or has expired/);
    assert.equal(f.state.hash, 'old-hash');
  }
});
test('forgot response does not expose accounts, provider errors or reset tokens', async () => {
  const responses = [];
  for (const options of [{}, { missing: true }, { disabled: true }, { mailFailure: true }]) {
    const f = fixture(options); await f.controller.forgotPassword(f.req, f.res); responses.push(JSON.stringify(f.response()));
    assert.ok(!JSON.stringify(f.response()).includes('raw-token'));
    if (options.mailFailure) assert.equal(f.state.deleted, true);
  }
  assert.equal(new Set(responses).size, 1);
});
test('JWT credential version changes when password changes', () => {
  const previous = process.env.JWT_SECRET; process.env.JWT_SECRET = 'test-only-secret';
  try {
    const user = { id: 7, password_hash: 'old-hash', role_name: 'AGENT' };
    const payload = jwt.verify(createJwt(user), process.env.JWT_SECRET);
    assert.equal(payload.credential, credentialVersion(user));
    user.password_hash = 'new-hash'; assert.notEqual(payload.credential, credentialVersion(user));
  } finally { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; }
});
