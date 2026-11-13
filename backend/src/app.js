require('dotenv').config();
require('express-async-errors');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const logger = require('./utils/logger');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(cors({ origin: String(process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map((value) => value.trim()), credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (message) => logger.http(message.trim()) } }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth', authLimiter, require('./routes/authRoutes'));
app.use('/api/public', require('./routes/publicRoutes'));
app.use('/api/applications', require('./routes/applicationRoutes'));
app.use('/api/documents', require('./routes/documentRoutes'));
app.use('/api/files', require('./routes/fileRoutes'));
app.use('/api/field', require('./routes/fieldRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/payment-submissions', require('./routes/paymentSubmissionRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/collections', require('./routes/collectionRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));

try {
  const openapi = YAML.load(path.join(__dirname, '../openapi.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi));
} catch (error) {
  logger.warn('OpenAPI file could not be loaded.', { message: error.message });
}
app.get('/api/health', (_req, res) => res.json({ success: true, service: 'MicroFund API v3', timestamp: new Date().toISOString() }));
app.use(notFound);
app.use(errorHandler);
module.exports = app;
