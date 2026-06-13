const { getDB } = require('../config/db');

function upsert({ sessionId, issueIdentified, productDetected, resolutionSteps, resolutionStatus, actionItems, agentPerformanceScore }) {
  const db = getDB();
  const existing = db.prepare('SELECT id FROM ai_summaries WHERE session_id = ?').get(sessionId);
  if (existing) {
    db.prepare(`
      UPDATE ai_summaries SET
        issue_identified = ?, product_detected = ?, resolution_steps = ?,
        resolution_status = ?, action_items = ?, agent_performance_score = ?
      WHERE session_id = ?
    `).run(issueIdentified, productDetected,
      JSON.stringify(resolutionSteps || []),
      resolutionStatus || 'unresolved',
      JSON.stringify(actionItems || []),
      agentPerformanceScore || 70,
      sessionId);
    return db.prepare('SELECT * FROM ai_summaries WHERE session_id = ?').get(sessionId);
  } else {
    const result = db.prepare(`
      INSERT INTO ai_summaries
        (session_id, issue_identified, product_detected, resolution_steps,
         resolution_status, action_items, agent_performance_score)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, issueIdentified, productDetected,
      JSON.stringify(resolutionSteps || []),
      resolutionStatus || 'unresolved',
      JSON.stringify(actionItems || []),
      agentPerformanceScore || 70);
    return db.prepare('SELECT * FROM ai_summaries WHERE id = ?').get(result.lastInsertRowid);
  }
}

function findBySession(sessionId) {
  const row = getDB().prepare('SELECT * FROM ai_summaries WHERE session_id = ?').get(sessionId);
  return row ? parse(row) : null;
}

function getTopIssues(limit = 10) {
  return getDB().prepare(`
    SELECT issue_identified, COUNT(*) as count
    FROM ai_summaries
    WHERE issue_identified IS NOT NULL
    GROUP BY issue_identified
    ORDER BY count DESC
    LIMIT ?
  `).all(limit);
}

function getResolutionStats() {
  return getDB().prepare(`
    SELECT
      COUNT(*) as total,
      AVG(CASE WHEN resolution_status = 'unresolved' THEN 1.0 ELSE 0.0 END) * 100 as unresolved_rate,
      AVG(s.duration_secs) as avg_duration
    FROM ai_summaries a
    JOIN sessions s ON s.id = a.session_id
    WHERE s.duration_secs IS NOT NULL
  `).get();
}

function getSessionsPerDay(days = 7) {
  return getDB().prepare(`
    SELECT
      DATE(created_at) as day,
      COUNT(*) as count
    FROM sessions
    WHERE created_at >= DATE('now', '-${days} days')
    GROUP BY DATE(created_at)
    ORDER BY day ASC
  `).all();
}

function getTopProducts() {
  return getDB().prepare(`
    SELECT product_detected, COUNT(*) as count
    FROM ai_summaries
    WHERE product_detected IS NOT NULL AND product_detected != 'Unknown'
    GROUP BY product_detected
    ORDER BY count DESC
    LIMIT 5
  `).all();
}

function parse(row) {
  return {
    ...row,
    resolution_steps: tryParse(row.resolution_steps, []),
    action_items: tryParse(row.action_items, []),
  };
}

function tryParse(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

module.exports = { upsert, findBySession, getTopIssues, getResolutionStats, getSessionsPerDay, getTopProducts };
