const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const { getOverview, getTopIssues } = require('../controllers/intelligence.controller');

router.get('/overview', requireAuth, requireRole('admin'), getOverview);
router.get('/issues', requireAuth, requireRole('admin'), getTopIssues);

module.exports = router;
