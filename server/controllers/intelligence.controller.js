const aiSummaryModel = require('../models/aiSummary.model');
const sessionModel = require('../models/session.model');

function getOverview(req, res, next) {
  try {
    const stats = aiSummaryModel.getResolutionStats();
    const sessionsPerDay = aiSummaryModel.getSessionsPerDay(7);
    const topProducts = aiSummaryModel.getTopProducts();
    const totalSessions = sessionModel.countAll();
    const activeSessions = sessionModel.countActive();

    // Fill in missing days with 0
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];
      const found = sessionsPerDay.find((s) => s.day === dayStr);
      days.push({ day: dayStr, count: found ? found.count : 0 });
    }

    res.json({
      total_sessions: totalSessions,
      active_sessions: activeSessions,
      avg_duration_secs: Math.round(stats?.avg_duration || 0),
      unresolved_rate: Math.round(stats?.unresolved_rate || 0),
      sessions_per_day: days,
      top_products: topProducts,
    });
  } catch (err) { next(err); }
}

function getTopIssues(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const issues = aiSummaryModel.getTopIssues(limit);
    res.json(issues);
  } catch (err) { next(err); }
}

module.exports = { getOverview, getTopIssues };
