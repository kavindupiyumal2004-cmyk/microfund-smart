const { AuditLog } = require('../models');
const logger = require('../utils/logger');

async function audit(req, action, entityType, entityId, metadata = {}) {
  try {
    await AuditLog.create({
      user_id: req.user?.id || null,
      action,
      entity_type: entityType || null,
      entity_id: entityId ? String(entityId) : null,
      metadata,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });
  } catch (error) {
    logger.error('Failed to write audit log', { error: error.message, action });
  }
}

module.exports = { audit };
