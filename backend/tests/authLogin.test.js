const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function controller(user, passwordMatches) {
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
