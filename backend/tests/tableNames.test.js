const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

for (const mode of ['', 'lowercase']) {
  test(`model table mapping: ${mode || 'default'}`, () => {
    const result = execFileSync(process.execPath, ['-e', `
      const { sequelize, User, LoanApplication, Role } = require('./src/models');
      require('./src/services/documentStorage');
      const { recommendAgents } = require('./src/controllers/applicationController');
      const models = Object.values(sequelize.models);
      LoanApplication.findByPk = async () => ({ area_id: 1 });
      Role.findOne = async () => ({ id: 1 });
      let recommendationSql;
      sequelize.query = async sql => { recommendationSql = sql; return []; };
      recommendAgents({ params: { id: 1 }, query: { date: '2026-11-19' } },
        { json() {} }, error => { throw error; }).then(() => process.stdout.write(JSON.stringify({
        tables: models.map(model => [model.name, model.getTableName()]),
        references: models.flatMap(model => Object.values(model.rawAttributes)
          .filter(attribute => attribute.references).map(attribute => attribute.references.model)),
        roleAlias: User.associations.Role.as,
        recommendationSql,
      })));
    `], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, DB_TABLE_NAMES: mode },
      encoding: 'utf8',
    });
    const data = JSON.parse(result);
    assert.ok(data.tables.length > 20);
    for (const [name, table] of data.tables) {
      const lowercase = mode === 'lowercase' || name === 'DocumentFile';
      assert.equal(table, lowercase ? name.toLowerCase() : name);
    }
    const physicalTables = new Set(data.tables.map(([, table]) => table));
    assert.ok(data.references.length > 0);
    for (const reference of data.references) assert.ok(physicalTables.has(reference), reference);
    const visitTable = mode === 'lowercase' ? 'fieldvisit' : 'FieldVisit';
    assert.ok(data.recommendationSql.includes('FROM `' + visitTable + '` fv'));
    assert.equal(data.roleAlias, 'Role');
  });
}
