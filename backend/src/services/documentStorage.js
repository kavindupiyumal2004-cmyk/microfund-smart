const { randomUUID } = require('crypto');
const fs = require('fs/promises');
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const DocumentFile = sequelize.define('DocumentFile', {
  id: { type: DataTypes.UUID, primaryKey: true },
  contents: { type: DataTypes.BLOB('long'), allowNull: false },
}, { tableName: 'documentfile', timestamps: false });

let ready;
async function storeDocument(file, saveMetadata) {
  try {
    // Only create the new storage table. Existing loan and KYC tables are untouched.
    ready ||= DocumentFile.sync().catch((error) => { ready = null; throw error; });
    await ready;
    const contents = await fs.readFile(file.path);
    const id = randomUUID();
    return await sequelize.transaction(async (transaction) => {
      await DocumentFile.create({ id, contents }, { transaction });
      return saveMetadata('db:' + id, transaction);
    });
  } finally {
    await fs.unlink(file.path).catch(() => {});
  }
}

module.exports = { DocumentFile, storeDocument };
