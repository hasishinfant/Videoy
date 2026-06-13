const chatModel = require('../../models/chat.model');
const { socketSessionMap } = require('./room.handler');
const logger = require('../../utils/logger');

module.exports = function chatHandler(socket, callNs) {
  socket.on('chat:send', ({ message }, callback) => {
    try {
      const info = socketSessionMap.get(socket.id);
      if (!info) return callback?.({ error: 'Not in a session' });
      if (!message || typeof message !== 'string' || !message.trim()) {
        return callback?.({ error: 'Message cannot be empty' });
      }

      const saved = chatModel.add({
        sessionId: info.sessionId,
        senderName: info.displayName,
        senderRole: info.role,
        message: message.trim(),
      });

      const payload = {
        id: saved.id,
        senderName: saved.sender_name,
        senderRole: saved.sender_role,
        message: saved.message,
        sentAt: saved.sent_at,
      };

      // Broadcast to everyone in the room (including sender for confirmation)
      callNs.to(`session:${info.sessionToken}`).emit('chat:message', payload);
      callback?.({ success: true, message: payload });
    } catch (err) {
      logger.error('chat:send error:', err);
      callback?.({ error: err.message });
    }
  });
};
