const { analyzeVideoFrame } = require('../../services/gemini.service');
const visionModel = require('../../models/vision.model');
const { socketSessionMap } = require('./room.handler');
const logger = require('../../utils/logger');

// Rate limiter: socketId → last analysis timestamp
const lastAnalysis = new Map();
const MIN_INTERVAL_MS = 4000; // enforce minimum gap even if client sends faster

module.exports = function visionHandler(socket, callNs) {
  socket.on('vision-frame', async ({ imageBase64 }, callback) => {
    try {
      const info = socketSessionMap.get(socket.id);
      if (!info) return;

      // Rate limit
      const now = Date.now();
      const last = lastAnalysis.get(socket.id) || 0;
      if (now - last < MIN_INTERVAL_MS) return;
      lastAnalysis.set(socket.id, now);

      if (!imageBase64 || imageBase64.length < 100) return;

      // Strip data URI prefix if present
      const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

      logger.debug(`Vision frame received from ${socket.id}, session ${info.sessionToken}`);

      const result = await analyzeVideoFrame(base64);
      if (!result) return callback?.({ error: 'Analysis failed' });

      // Persist detection
      const detection = visionModel.add({
        sessionId: info.sessionId,
        detectedProduct: result.product,
        detectedIssue: result.issue,
        confidence: result.confidence,
        rawResponse: JSON.stringify(result),
      });

      // Find agent socket(s) in this room and emit only to them
      const roomKey = `session:${info.sessionToken}`;
      const socketsInRoom = await callNs.in(roomKey).fetchSockets();
      for (const s of socketsInRoom) {
        if (s.user?.role === 'agent') {
          s.emit('vision-result', {
            id: detection.id,
            product: result.product,
            issue: result.issue,
            confidence: result.confidence,
            detectedAt: detection.detected_at,
          });
        }
      }

      callback?.({ success: true });
    } catch (err) {
      logger.error('vision-frame error:', err);
      callback?.({ error: err.message });
    }
  });

  socket.on('disconnect', () => {
    lastAnalysis.delete(socket.id);
  });
};
