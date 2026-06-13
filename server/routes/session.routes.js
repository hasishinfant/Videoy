const Router = require('express').Router();
const {
  createSession, listSessions, getSession, getChatHistory, endSessionHandler, getSummary
} = require('../controllers/session.controller');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');

Router.post('/', requireAuth, requireRole('agent', 'admin'), createSession);
Router.get('/', requireAuth, requireRole('agent', 'admin'), listSessions);
Router.get('/:token', getSession);  // public — for customer join validation
Router.get('/:token/chat', requireAuth, requireRole('agent', 'admin'), getChatHistory);
Router.patch('/:token/end', requireAuth, requireRole('agent', 'admin'), endSessionHandler);
Router.get('/:token/summary', requireAuth, requireRole('agent', 'admin'), getSummary);

module.exports = Router;
