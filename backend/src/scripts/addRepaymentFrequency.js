require('dotenv').config();
const { DataTypes } = require('sequelize');
const { LoanApplication, Loan, sequelize } = require('../models');

async function migrate() {
  const db = sequelize.getQueryInterface();
  for (const [model, column] of [[LoanApplication, 'requested_frequency'], [Loan, 'repayment_frequency']]) {
    const table = model.getTableName();
    const columns = await db.describeTable(table);
    if (!columns[column]) {
      await db.addColumn(table, column, { type: DataTypes.ENUM('WEEKLY', 'MONTHLY'), allowNull: true });
    }
  }
  console.log('Repayment frequency columns are ready.');
}
migrate().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => sequelize.close());
