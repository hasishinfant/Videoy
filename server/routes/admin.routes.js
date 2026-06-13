const Router = require('express').Router();
const { getLiveSessions, getAllSessions, forceEndSession, getStats } = require('../controllers/admin.controller');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');

Router.use(requireAuth, requireRole('admin'));

Router.get('/sessions/live', getLiveSessions);
Router.get('/sessions', getAllSessions);
Router.patch('/sessions/:token/end', forceEndSession);
Router.get('/stats', getStats);

module.exports = Router;
