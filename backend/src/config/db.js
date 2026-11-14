const { Sequelize } = require('sequelize');

const logging = String(process.env.DB_LOGGING).toLowerCase() === 'true' ? console.log : false;

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql',
    dialectOptions: String(process.env.DB_SSL).toLowerCase() === 'true'
      ? { ssl: {
        rejectUnauthorized: true,
        ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n') } : {}),
      } }
      : {},
    logging,
    define: {
      underscored: true,
      freezeTableName: true,
      timestamps: true,
    },
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  },
);

// Windows MySQL exports can contain lowercase table names. Keep model names
// and association aliases intact while mapping to those existing SQL tables.
if (String(process.env.DB_TABLE_NAMES).toLowerCase() === 'lowercase') {
  sequelize.addHook('beforeDefine', (_attributes, options) => {
    options.tableName = (options.tableName || options.modelName).toLowerCase();
  });
}

module.exports = sequelize;
