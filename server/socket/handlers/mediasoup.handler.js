const mediasoupService = require('../../services/mediasoup.service');
const { socketSessionMap } = require('./room.handler');
const logger = require('../../utils/logger');

module.exports = function mediasoupHandler(socket, callNs) {
  function getSession() {
    return socketSessionMap.get(socket.id);
  }

  // ── Get Router RTP Capabilities ──────────────────────────────────────────────
  socket.on('media:getRouterCapabilities', (_, callback) => {
    try {
      const info = getSession();
      if (!info) return callback?.({ error: 'Not in a session' });
      const rtpCapabilities = mediasoupService.getRouterRtpCapabilities(info.sessionToken);
      callback?.({ rtpCapabilities });
    } catch (err) {
      logger.error('media:getRouterCapabilities error:', err);
      callback?.({ error: err.message });
    }
  });

  // ── Create WebRTC Transport ──────────────────────────────────────────────────
  socket.on('media:createTransport', async ({ direction }, callback) => {
    try {
      const info = getSession();
      if (!info) return callback?.({ error: 'Not in a session' });
      const params = await mediasoupService.createWebRtcTransport(info.sessionToken, socket.id, direction);
      callback?.({ ...params });
    } catch (err) {
      logger.error('media:createTransport error:', err);
      callback?.({ error: err.message });
    }
  });

  // ── Connect Transport ────────────────────────────────────────────────────────
  socket.on('media:connectTransport', async ({ transportId, dtlsParameters }, callback) => {
    try {
      const info = getSession();
      if (!info) return callback?.({ error: 'Not in a session' });
      await mediasoupService.connectTransport(info.sessionToken, socket.id, transportId, dtlsParameters);
      callback?.({ success: true });
    } catch (err) {
      logger.error('media:connectTransport error:', err);
      callback?.({ error: err.message });
    }
  });

  // ── Produce (send stream) ────────────────────────────────────────────────────
  socket.on('media:produce', async ({ transportId, kind, rtpParameters, appData }, callback) => {
    try {
      const info = getSession();
      if (!info) return callback?.({ error: 'Not in a session' });

      const producerId = await mediasoupService.produce(info.sessionToken, socket.id, {
        transportId, kind, rtpParameters, appData,
      });

      // Notify all other peers in room about new producer
      socket.to(`session:${info.sessionToken}`).emit('media:newProducer', {
        producerId,
        socketId: socket.id,
        kind,
      });

      callback?.({ producerId });
    } catch (err) {
      logger.error('media:produce error:', err);
      callback?.({ error: err.message });
    }
  });

  // ── Consume (receive stream) ─────────────────────────────────────────────────
  socket.on('media:consume', async ({ producerId, rtpCapabilities }, callback) => {
    try {
      const info = getSession();
      if (!info) return callback?.({ error: 'Not in a session' });

      const params = await mediasoupService.consume(info.sessionToken, socket.id, {
        producerId, rtpCapabilities,
      });
      callback?.({ ...params });
    } catch (err) {
      logger.error('media:consume error:', err);
      callback?.({ error: err.message });
    }
  });

  // ── Resume Consumer ──────────────────────────────────────────────────────────
  socket.on('media:resumeConsumer', async ({ consumerId }, callback) => {
    try {
      const info = getSession();
      if (!info) return callback?.({ error: 'Not in a session' });
      await mediasoupService.resumeConsumer(info.sessionToken, socket.id, consumerId);
      callback?.({ success: true });
    } catch (err) {
      callback?.({ error: err.message });
    }
  });

  // ── Pause Producer (mute) ────────────────────────────────────────────────────
  socket.on('media:pauseProducer', async ({ producerId }, callback) => {
    try {
      const info = getSession();
      if (!info) return callback?.({ error: 'Not in a session' });
      await mediasoupService.pauseProducer(info.sessionToken, socket.id, producerId);
      socket.to(`session:${info.sessionToken}`).emit('media:producerPaused', { producerId, socketId: socket.id });
      callback?.({ success: true });
    } catch (err) {
      callback?.({ error: err.message });
    }
  });

  // ── Resume Producer (unmute) ─────────────────────────────────────────────────
  socket.on('media:resumeProducer', async ({ producerId }, callback) => {
    try {
      const info = getSession();
      if (!info) return callback?.({ error: 'Not in a session' });
      await mediasoupService.resumeProducer(info.sessionToken, socket.id, producerId);
      socket.to(`session:${info.sessionToken}`).emit('media:producerResumed', { producerId, socketId: socket.id });
      callback?.({ success: true });
    } catch (err) {
      callback?.({ error: err.message });
    }
  });

  // ── Get existing producers (for late joiners) ────────────────────────────────
  socket.on('media:getProducers', (_, callback) => {
    try {
      const info = getSession();
      if (!info) return callback?.({ error: 'Not in a session' });
      const producers = mediasoupService.getProducersInRoom(info.sessionToken, socket.id);
      callback?.({ producers });
    } catch (err) {
      callback?.({ error: err.message });
    }
  });
};
