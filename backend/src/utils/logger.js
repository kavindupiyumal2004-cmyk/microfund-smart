const path = require('path');
const fs = require('fs');
const winston = require('winston');

const logDir = path.join(__dirname, '../../logs');
fs.mkdirSync(logDir, { recursive: true });

const format = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format,
  defaultMeta: { service: 'microfund-api' },
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logDir, 'combined.log') }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
  }));
}

module.exports = logger;
