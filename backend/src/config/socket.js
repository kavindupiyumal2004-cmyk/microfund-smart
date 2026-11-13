const jwt = require('jsonwebtoken');
const { User, Role } = require('../models');
const logger = require('../utils/logger');

function configureSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(payload.sub, { include: Role });
      if (!user || !user.is_active) return next(new Error('Unauthorized'));
      socket.user = user;
      return next();
    } catch (_error) { return next(new Error('Unauthorized')); }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);
    socket.join(`role:${socket.user.Role.name}`);
    logger.debug('Socket connected', { userId: socket.user.id });
  });
}

module.exports = configureSocket;
