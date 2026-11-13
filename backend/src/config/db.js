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
    logging,
    define: {
      underscored: true,
      freezeTableName: true,
      timestamps: true,
    },
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  },
);

module.exports = sequelize;
