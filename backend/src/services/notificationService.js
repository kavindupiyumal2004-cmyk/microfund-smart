const { Notification, User, Role } = require('../models');
const { sendMail, importantEventTemplate } = require('./emailService');
const logger = require('../utils/logger');

let io;
const setSocketServer = (socketServer) => { io = socketServer; };

async function deliverImportantEmail(userId, emailConfig) {
  if (!emailConfig) return;
  try {
    const user = await User.findByPk(userId, { attributes: ['id', 'full_name', 'email', 'is_active'] });
    if (!user?.email || !user.is_active) return;
    const template = importantEventTemplate(user.full_name, emailConfig);
    const result = await sendMail({ to: user.email, ...template });
    if (result?.skipped) logger.warn('Important email skipped', { userId, kind: emailConfig.kind, reason: result.reason });
  } catch (error) {
    // Email delivery must never roll back a successful loan/payment action.
    logger.error('Important email delivery failed', { userId, kind: emailConfig.kind, message: error.message, code: error.code });
  }
}

function scheduleImportantEmail(userId, emailConfig, transaction) {
  if (!emailConfig) return;
  const dispatch = () => setImmediate(() => { void deliverImportantEmail(userId, emailConfig); });
  if (transaction?.afterCommit) transaction.afterCommit(dispatch);
  else dispatch();
}

async function notifyUser(userId, payload, transaction) {
  const { email, ...notificationPayload } = payload || {};
  const notification = await Notification.create({ user_id: userId, ...notificationPayload }, { transaction });
  if (io) io.to(`user:${userId}`).emit('notification:new', notification.toJSON());
  scheduleImportantEmail(userId, email, transaction);
  return notification;
}

async function notifyRole(roleName, payload, transaction) {
  const users = await User.findAll({ include: [{ model: Role, where: { name: roleName } }], where: { is_active: true }, transaction });
  const records = [];
  for (const user of users) records.push(await notifyUser(user.id, payload, transaction));
  if (io) io.to(`role:${roleName}`).emit('notification:role', payload);
  return records;
}

module.exports = { setSocketServer, notifyUser, notifyRole };
