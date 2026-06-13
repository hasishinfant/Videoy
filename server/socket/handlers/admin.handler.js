const sessionModel = require('../../models/session.model');
const { endSession } = require('../../services/session.service');
const logger = require('../../utils/logger');

module.exports = function adminHandler(socket, adminNs) {
  // Join the admin room to receive broadcast updates
  socket.join('admin_room');

  // Send current live sessions immediately on connect
  socket.emit('admin:sessionUpdate', { sessions: sessionModel.findAllActive() });

  // Admin force-ends a session via socket
  socket.on('admin:endSession', async ({ sessionToken }, callback) => {
    try {
      const session = sessionModel.findByToken(sessionToken);
      if (!session) return callback?.({ error: 'Session not found' });

      await endSession(sessionToken);

      // Broadcast updated live list
      adminNs.to('admin_room').emit('admin:sessionUpdate', {
        sessions: sessionModel.findAllActive(),
      });

      callback?.({ success: true });
    } catch (err) {
      logger.error('admin:endSession error:', err);
      callback?.({ error: err.message });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Admin socket disconnected: ${socket.id}`);
  });
};
