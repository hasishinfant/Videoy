const { getDB } = require('../config/db');

function add({ sessionId, detectedProduct, detectedIssue, confidence, rawResponse }) {
  const stmt = getDB().prepare(
    'INSERT INTO vision_detections (session_id, detected_product, detected_issue, confidence, raw_response) VALUES (?, ?, ?, ?, ?)'
  );
  const result = stmt.run(sessionId, detectedProduct, detectedIssue, confidence, rawResponse || null);
  return getDB().prepare('SELECT * FROM vision_detections WHERE id = ?').get(result.lastInsertRowid);
}

function findBySession(sessionId) {
  return getDB()
    .prepare('SELECT * FROM vision_detections WHERE session_id = ? ORDER BY detected_at ASC')
    .all(sessionId);
}

function findRecentBySession(sessionId, limit = 10) {
  return getDB()
    .prepare('SELECT * FROM vision_detections WHERE session_id = ? ORDER BY detected_at DESC LIMIT ?')
    .all(sessionId, limit);
}

module.exports = { add, findBySession, findRecentBySession };
