require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { sequelize } = require('./models');
const configureSocket = require('./config/socket');
const { setSocketServer } = require('./services/notificationService');
const logger = require('./utils/logger');

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required in .env');
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: (process.env.FRONTEND_URL || 'http://localhost:5173').split(','), credentials: true } });
configureSocket(io);
setSocketServer(io);

const port = Number(process.env.PORT || 5000);
(async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established.');
    if (String(process.env.DB_SYNC).toLowerCase() === 'true') await sequelize.sync({ alter: process.env.NODE_ENV !== 'production' });
    server.listen(port, () => logger.info(`MicroFund API running at http://localhost:${port}`));
  } catch (error) {
    logger.error('Failed to start server', { error: error.stack });
    process.exit(1);
  }
})();

process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection', { reason }));
process.on('uncaughtException', (error) => { logger.error('Uncaught exception', { error: error.stack }); process.exit(1); });
