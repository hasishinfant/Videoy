const sessionModel = require('../models/session.model');
const chatModel = require('../models/chat.model');
const participantModel = require('../models/participant.model');
const { generateSessionToken, buildInviteLink } = require('../utils/inviteToken');
const { endSession } = require('../services/session.service');

async function createSession(req, res, next) {
  try {
    const agentId = req.user.sub;
    const sessionToken = generateSessionToken();
    const session = sessionModel.create({ sessionToken, createdBy: agentId });
    const { inviteUrl, inviteJWT } = buildInviteLink(sessionToken);
    res.status(201).json({ session, inviteUrl, inviteJWT });
  } catch (err) { next(err); }
}

function listSessions(req, res, next) {
  try {
    const sessions = sessionModel.findByAgent(req.user.sub);
    res.json(sessions);
  } catch (err) { next(err); }
}

function getSession(req, res, next) {
  try {
    const session = sessionModel.findByToken(req.params.token);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    // Public endpoint — only return safe fields for customer join validation
    res.json({
      id: session.id,
      session_token: session.session_token,
      status: session.status,
      created_at: session.created_at,
    });
  } catch (err) { next(err); }
}

function getChatHistory(req, res, next) {
  try {
    const session = sessionModel.findByToken(req.params.token);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const messages = chatModel.findBySession(session.id);
    res.json(messages);
  } catch (err) { next(err); }
}

async function endSessionHandler(req, res, next) {
  try {
    const session = sessionModel.findByToken(req.params.token);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Only the session creator or admin can end it
    if (req.user.role !== 'admin' && session.created_by !== req.user.sub) {
      return res.status(403).json({ error: 'Not authorized to end this session' });
    }

    const summary = await endSession(req.params.token);
    res.json({ success: true, aiSummary: summary });
  } catch (err) { next(err); }
}

function getSummary(req, res, next) {
  try {
    const session = sessionModel.findByToken(req.params.token);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (req.user.role !== 'admin' && session.created_by !== req.user.sub) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const summary = session.ai_summary ? JSON.parse(session.ai_summary) : null;
    const participants = participantModel.findBySession(session.id);
    const chatHistory = chatModel.findBySession(session.id);
    res.json({ session, summary, participants, chatHistory });
  } catch (err) { next(err); }
}

module.exports = { createSession, listSessions, getSession, getChatHistory, endSessionHandler, getSummary };
