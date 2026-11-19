const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, writeFile, access, rmdir } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { CustomerDocument, sequelize } = require('../src/models');
const { DocumentFile, storeDocument } = require('../src/services/documentStorage');
const controller = require('../src/controllers/fileController');

test('authorized preview returns stored bytes after the upload file is removed', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'microfund-preview-'));
  t.after(() => rmdir(directory));
  const upload = path.join(directory, 'sample.pdf');
  const pdf = Buffer.from('%PDF-1.4 test');
  await writeFile(upload, pdf);
  const transaction = {};
  let stored;
  t.mock.method(sequelize, 'transaction', callback => callback(transaction));
  t.mock.method(DocumentFile, 'sync', async () => {});
  t.mock.method(DocumentFile, 'create', async (record, options) => {
    assert.equal(options.transaction, transaction);
    stored = record;
  });
  const row = await storeDocument({ path: upload }, (file_path, tx) => {
    assert.equal(tx, transaction);
    return { file_path, mime_type: 'application/pdf', original_name: 'test.pdf', user_id: 2 };
  });
  await assert.rejects(access(upload), { code: 'ENOENT' });
  t.mock.method(CustomerDocument, 'findByPk', async () => row);
  const lookup = t.mock.method(DocumentFile, 'findByPk', async id => {
    assert.equal(id, stored.id);
    return stored;
  });
  const req = { params: { id: 9 }, query: {}, user: { Role: { name: 'CUSTOMER' }, id: 7 } };
  const headers = {};
  const res = { setHeader: (key, value) => { headers[key] = value; }, send: bytes => bytes };
  const fail = error => { throw error; };
  await assert.rejects(controller.customerDocument(req, res, fail), { statusCode: 403 });
  assert.equal(lookup.mock.callCount(), 0);
  req.user.id = 2;
  assert.deepEqual(await controller.customerDocument(req, res, fail), pdf);
  assert.equal(headers['Content-Type'], 'application/pdf');
  assert.match(headers['Content-Disposition'], /^inline/);
  req.query.download = 'true';
  assert.deepEqual(await controller.customerDocument(req, res, fail), pdf);
  assert.match(headers['Content-Disposition'], /^attachment/);
});
