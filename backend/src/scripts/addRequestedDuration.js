require('dotenv').config();
const { DataTypes } = require('sequelize');
const { LoanApplication, sequelize } = require('../models');

async function migrate() {
  const db = sequelize.getQueryInterface();
  const table = LoanApplication.getTableName();
  const columns = await db.describeTable(table);
  if (!columns.requested_duration_months) {
    await db.addColumn(table, 'requested_duration_months', {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    });
  }
  console.log('Requested loan term column is ready.');
}

migrate().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => sequelize.close());
