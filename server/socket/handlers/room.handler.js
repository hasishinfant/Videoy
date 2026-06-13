const sessionModel = require('../../models/session.model');
const participantModel = require('../../models/participant.model');
const chatModel = require('../../models/chat.model');
const { createRoom } = require('../../services/mediasoup.service');
const { endSession } = require('../../services/session.service');
const logger = require('../../utils/logger');

// socketId → { sessionToken, sessionId, displayName, role }
const socketSessionMap = new Map();
// sessionToken → NodeJS.Timeout
const agentDisconnectTimeouts = new Map();

function getRoomKey(sessionToken) {
  return `session:${sessionToken}`;
}

function notifyAdmin() {
  try {
    // Lazy require to avoid circular dependency (socket/index → room.handler → socket/index)
    const { getAdminNamespace } = require('../index');
    const adminNs = getAdminNamespace();
    if (adminNs) {
      adminNs.to('admin_room').emit('admin:sessionUpdate', {
        sessions: sessionModel.findAllActive(),
      });
    }
  } catch {}
}


module.exports = function roomHandler(socket, callNs) {
  // ── room:join ────────────────────────────────────────────────────────────────
  socket.on('room:join', async ({ sessionToken, displayName }, callback) => {
    try {
      if (!sessionToken || !displayName) {
        return callback?.({ error: 'sessionToken and displayName are required' });
      }

      // Cancel any pending disconnect timeout for this session
      if (agentDisconnectTimeouts.has(sessionToken)) {
        clearTimeout(agentDisconnectTimeouts.get(sessionToken));
        agentDisconnectTimeouts.delete(sessionToken);
        logger.info(`Cancelled auto-end timeout for session ${sessionToken} (agent reconnected)`);
      }

      const session = sessionModel.findByToken(sessionToken);
      if (!session) return callback?.({ error: 'Session not found' });
      if (session.status === 'ended') return callback?.({ error: 'Session has ended' });

      // Customer can only join sessions they have an invite for
      if (socket.user.role === 'customer' && socket.user.sessionToken !== sessionToken) {
        return callback?.({ error: 'Invalid invite for this session' });
      }

      // Create mediasoup room if not exists
      await createRoom(sessionToken);

      // Join socket room
      const roomKey = getRoomKey(sessionToken);
      socket.join(roomKey);

      // Update session to active if waiting
      if (session.status === 'waiting') {
        sessionModel.markStarted(sessionToken);
      }

      // Record participant
      const participant = participantModel.add({
        sessionId: session.id,
        displayName,
        role: socket.user.role,
        socketId: socket.id,
      });

      socketSessionMap.set(socket.id, { sessionToken, sessionId: session.id, displayName, role: socket.user.role });

      // Fetch existing participants and chat history
      const participants = participantModel.findActiveBySession(session.id);
      const chatHistory = chatModel.findBySession(session.id);

      // Notify others in room
      socket.to(roomKey).emit('room:participantJoined', {
        participantId: participant.id,
        displayName,
        role: socket.user.role,
        socketId: socket.id,
      });

      notifyAdmin();
      logger.info(`${displayName} (${socket.user.role}) joined session ${sessionToken}`);

      callback?.({ success: true, sessionId: session.id, participants, chatHistory });
    } catch (err) {
      logger.error('room:join error:', err);
      callback?.({ error: err.message });
    }
  });

  // ── room:leave ───────────────────────────────────────────────────────────────
  socket.on('room:leave', () => handleLeave(socket, callNs));

  // ── room:end (agent only) ────────────────────────────────────────────────────
  socket.on('room:end', async (_, callback) => {
    if (socket.user.role === 'customer') {
      return callback?.({ error: 'Customers cannot end sessions' });
    }
    const info = socketSessionMap.get(socket.id);
    if (!info) return callback?.({ error: 'Not in a session' });

    const roomKey = getRoomKey(info.sessionToken);
    await endSession(info.sessionToken, ({ reason, aiSummary }) => {
      callNs.to(roomKey).emit('room:ended', { reason, aiSummary });
    });
    notifyAdmin();
    callback?.({ success: true });
  });

  // ── disconnect ───────────────────────────────────────────────────────────────
  socket.on('disconnect', () => handleLeave(socket, callNs));
};

async function handleLeave(socket, callNs) {
  const info = socketSessionMap.get(socket.id);
  if (!info) return;

  participantModel.markLeft(socket.id);
  socketSessionMap.delete(socket.id);

  const roomKey = getRoomKey(info.sessionToken);
  callNs.to(roomKey).emit('room:participantLeft', { socketId: socket.id, displayName: info.displayName });

  // If agent leaves, auto-end session after 10-second grace period (handles React StrictMode & refreshes)
  if (info.role === 'agent') {
    const session = sessionModel.findByToken(info.sessionToken);
    if (session && session.status === 'active') {
      // Clear existing timeout if any
      if (agentDisconnectTimeouts.has(info.sessionToken)) {
        clearTimeout(agentDisconnectTimeouts.get(info.sessionToken));
      }
      
      const timeoutId = setTimeout(async () => {
        agentDisconnectTimeouts.delete(info.sessionToken);
        const currentSession = sessionModel.findByToken(info.sessionToken);
        if (currentSession && currentSession.status === 'active') {
          await endSession(info.sessionToken, ({ reason, aiSummary }) => {
            callNs.to(roomKey).emit('room:ended', { reason: 'agent_disconnected', aiSummary });
          });
          notifyAdmin();
        }
      }, 10000); // 10-second grace period
      agentDisconnectTimeouts.set(info.sessionToken, timeoutId);
      logger.info(`Scheduled auto-end for session ${info.sessionToken} in 10s unless agent reconnects`);
    }
  }

  notifyAdmin();
  logger.info(`${info.displayName} left session ${info.sessionToken}`);
}

module.exports.socketSessionMap = socketSessionMap;
