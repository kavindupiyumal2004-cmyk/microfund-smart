require('dotenv').config();
const { sequelize } = require('../models');
(async () => { try { await sequelize.authenticate(); await sequelize.sync({ alter: true }); console.log('Database schema synchronized.'); process.exit(0); } catch (e) { console.error(e); process.exit(1); } })();
