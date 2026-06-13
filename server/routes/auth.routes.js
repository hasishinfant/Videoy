const Router = require('express').Router();
const { login, register, me } = require('../controllers/auth.controller');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');

Router.post('/login', login);
Router.post('/register', requireAuth, requireRole('admin'), register);
Router.get('/me', requireAuth, me);

module.exports = Router;
