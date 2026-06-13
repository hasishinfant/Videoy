const { Server } = require('socket.io');
const { verifyToken } = require('../services/token.service');
const { verifyInviteToken } = require('../middleware/auth.middleware');
const roomHandler = require('./handlers/room.handler');
const mediasoupHandler = require('./handlers/mediasoup.handler');
const chatHandler = require('./handlers/chat.handler');
const visionHandler = require('./handlers/vision.handler');
const copilotHandler = require('./handlers/copilot.handler');
const adminHandler = require('./handlers/admin.handler');
const logger = require('../utils/logger');

let adminNamespace = null;

function getAdminNamespace() {
  return adminNamespace;
}

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Increase max message size for vision frames (base64 images ~100KB)
    maxHttpBufferSize: 2e6, // 2MB
  });

  // ── /call namespace ──────────────────────────────────────────────────────────
  const callNs = io.of('/call');

  callNs.use((socket, next) => {
    const { token, inviteToken } = socket.handshake.auth;

    if (token) {
      try {
        socket.user = verifyToken(token);
        return next();
      } catch {
        return next(new Error('Invalid agent token'));
      }
    }

    if (inviteToken) {
      const payload = verifyInviteToken(inviteToken);
      if (!payload) return next(new Error('Invalid invite token'));
      socket.user = { role: 'customer', sessionToken: payload.sessionToken };
      return next();
    }

    return next(new Error('Authentication required'));
  });

  callNs.on('connection', (socket) => {
    logger.info(`Socket connected [/call]: ${socket.id} role=${socket.user?.role}`);
    roomHandler(socket, callNs);
    mediasoupHandler(socket, callNs);
    chatHandler(socket, callNs);
    visionHandler(socket, callNs);
    copilotHandler(socket);
  });

  // ── /admin namespace ─────────────────────────────────────────────────────────
  adminNamespace = io.of('/admin');

  adminNamespace.use((socket, next) => {
    const { token } = socket.handshake.auth;
    if (!token) return next(new Error('Admin token required'));
    try {
      const user = verifyToken(token);
      if (user.role !== 'admin') return next(new Error('Admin role required'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  adminNamespace.on('connection', (socket) => {
    logger.info(`Socket connected [/admin]: ${socket.id}`);
    adminHandler(socket, adminNamespace);
  });

  return io;
}

module.exports = { initSocket, getAdminNamespace };
