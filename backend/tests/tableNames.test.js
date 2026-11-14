const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

for (const mode of ['', 'lowercase']) {
  test(`model table mapping: ${mode || 'default'}`, () => {
    const result = execFileSync(process.execPath, ['-e', `
      const { sequelize, User } = require('./src/models');
      const models = Object.values(sequelize.models);
      process.stdout.write(JSON.stringify({
        tables: models.map(model => [model.name, model.getTableName()]),
        roleReference: User.rawAttributes.role_id.references.model,
        roleAlias: User.associations.Role.as,
      }));
    `], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, DB_TABLE_NAMES: mode },
      encoding: 'utf8',
    });
    const data = JSON.parse(result);
    assert.ok(data.tables.length > 20);
    for (const [name, table] of data.tables) {
      assert.equal(table, mode === 'lowercase' ? name.toLowerCase() : name);
    }
    assert.equal(data.roleReference, mode === 'lowercase' ? 'role' : 'Role');
    assert.equal(data.roleAlias, 'Role');
  });
}
