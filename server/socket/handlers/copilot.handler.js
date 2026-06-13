const { getCopilotSuggestion } = require('../../services/gemini.service');
const chatModel = require('../../models/chat.model');
const visionModel = require('../../models/vision.model');
const { socketSessionMap } = require('./room.handler');
const logger = require('../../utils/logger');

module.exports = function copilotHandler(socket) {
  socket.on('copilot-ask', async ({ question }, callback) => {
    try {
      if (socket.user?.role !== 'agent') {
        return callback?.({ error: 'Only agents can use copilot' });
      }

      const info = socketSessionMap.get(socket.id);
      if (!info) return callback?.({ error: 'Not in a session' });

      if (!question || !question.trim()) {
        return callback?.({ error: 'Question is required' });
      }

      const chatHistory = chatModel.findBySession(info.sessionId);
      const visionDetections = visionModel.findRecentBySession(info.sessionId, 5);

      const result = await getCopilotSuggestion(chatHistory, visionDetections, question.trim());

      if (!result) {
        return callback?.({ error: 'Copilot unavailable — check GEMINI_API_KEY' });
      }

      // Emit only back to the requesting agent socket
      socket.emit('copilot-suggestion', {
        question: question.trim(),
        suggestion: result.suggestion,
        escalate: result.escalate,
        confidence: result.confidence,
        timestamp: new Date().toISOString(),
      });

      callback?.({ success: true });
    } catch (err) {
      logger.error('copilot-ask error:', err);
      callback?.({ error: err.message });
    }
  });
};
