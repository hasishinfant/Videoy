const sessionModel = require('../models/session.model');
const participantModel = require('../models/participant.model');
const { endSession } = require('../services/session.service');


function getLiveSessions(req, res, next) {
  try {
    const sessions = sessionModel.findAllActive();
    res.json(sessions);
  } catch (err) { next(err); }
}

function getAllSessions(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const sessions = sessionModel.findAll(limit, offset);
    const total = sessionModel.countAll();
    res.json({ sessions, total, limit, offset });
  } catch (err) { next(err); }
}

async function forceEndSession(req, res, next) {
  try {
    const { token } = req.params;
    const session = sessionModel.findByToken(token);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'ended') return res.json({ message: 'Session already ended' });

    const summary = await endSession(token);
    // Notify admin dashboard clients (lazy require to break circular dependency)
    try {
      const { getAdminNamespace } = require('../socket');
      const adminNs = getAdminNamespace();
      if (adminNs) {
        adminNs.to('admin_room').emit('admin:sessionUpdate', { sessions: sessionModel.findAllActive() });
      }
    } catch {}
    res.json({ success: true, aiSummary: summary });
  } catch (err) { next(err); }
}

function getStats(req, res, next) {
  try {
    const total = sessionModel.countAll();
    const active = sessionModel.countActive();
    res.json({ total_sessions: total, active_sessions: active });
  } catch (err) { next(err); }
}

module.exports = { getLiveSessions, getAllSessions, forceEndSession, getStats };
