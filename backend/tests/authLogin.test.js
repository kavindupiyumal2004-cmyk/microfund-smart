const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function controller(user, passwordMatches, overrides = {}) {
  const exported = {};
  const mocks = {
    bcryptjs: { compare: async () => passwordMatches },
    dayjs: {},
    sequelize: { Op: {} },
    path: {},
    '../models': { User: { findOne: async () => user }, Role: {}, CustomerProfile: {} },
    '../utils/asyncHandler': (handler) => handler,
    '../middleware/errorHandler': { AppError: class extends Error {
      constructor(message, status, code) { super(message); this.status = status; this.code = code; }
    } },
    '../utils/tokens': { createJwt: () => 'test-token' },
    '../services/emailService': {},
    '../services/auditService': { audit: async () => {} },
    '../utils/files': {},
  };
  Object.assign(mocks, overrides);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/authController.js'), 'utf8'), {
    exports: exported,
    require: (name) => { if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`); return mocks[name]; },
  });
  return exported;
}

const request = { body: { email: 'customer@example.com', password: 'test-password' } };
test('active customer can log in without email verification', async () => {
  let updated = false;
  const user = { id: 1, email: request.body.email, Role: { name: 'CUSTOMER' }, is_active: true,
    email_verified_at: null, update: async () => { updated = true; } };
  let response;
  await controller(user, true).login(request, { json: (body) => { response = body; } });
  assert.equal(response.token, 'test-token');
  assert.equal(response.user.email_verified_at, null);
  assert.equal(updated, true);
});
test('incorrect password remains rejected', async () => {
  await assert.rejects(controller({ id: 1 }, false).login(request, {}), { code: 'INVALID_CREDENTIALS' });
});
test('disabled account remains rejected', async () => {
  await assert.rejects(controller({ id: 1, is_active: false }, true).login(request, {}), { code: 'ACCOUNT_DISABLED' });
});

function registrationFixture({ duplicate = false, profileFailure = false } = {}) {
  const calls = [];
  const transaction = {
    commit: async () => { calls.push('commit'); transaction.finished = true; },
    rollback: async () => { calls.push('rollback'); transaction.finished = true; },
  };
  const handlers = controller(null, false, {
    bcryptjs: { hash: async () => 'hashed-password' },
    '../models': {
      User: {
        findOne: async () => duplicate ? { id: 1 } : null,
        sequelize: { transaction: async () => transaction },
        create: async (values) => { calls.push('user'); return { ...values, id: 42 }; },
      },
      Role: { findOne: async () => ({ id: 5, name: 'CUSTOMER' }) },
      CustomerProfile: {
        findOne: async () => null,
        create: async (values) => { if (profileFailure) throw new Error('Profile failed'); calls.push('profile'); return values; },
      },
      Area: { findByPk: async () => ({ id: 1, is_active: true }) },
    },
  });
  return { handlers, calls };
}

const registrationRequest = { body: {
  full_name: 'New Customer', email: 'customer@example.com', password: 'TestPassword123',
  nic: '123456789V', phone: '0771234567', address_line1: '123 Main Street', city: 'Colombo', area_id: 1,
} };

test('registration without files creates account and profile and returns a customer session', async () => {
  const { handlers, calls } = registrationFixture();
  let result;
  const res = { status: (code) => { assert.equal(code, 201); return res; }, json: (data) => { result = data; } };
  await handlers.register(registrationRequest, res);
  assert.deepEqual(calls, ['user', 'profile', 'commit']);
  assert.equal(result.token, 'test-token');
  assert.equal(result.user.role, 'CUSTOMER');
  assert.equal(result.user.profile.nic, '123456789V');
  assert.equal(result.user.password_hash, undefined);
});

test('registration still rejects existing accounts', async () => {
  const { handlers, calls } = registrationFixture({ duplicate: true });
  await assert.rejects(handlers.register(registrationRequest, {}), { code: 'ACCOUNT_EXISTS' });
  assert.deepEqual(calls, []);
});

test('profile failure rolls back account registration', async () => {
  const { handlers, calls } = registrationFixture({ profileFailure: true });
  await assert.rejects(handlers.register(registrationRequest, {}), /Profile failed/);
  assert.deepEqual(calls, ['user', 'rollback']);
});
