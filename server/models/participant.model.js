const { getDB } = require('../config/db');

function add({ sessionId, displayName, role, socketId }) {
  const stmt = getDB().prepare(
    'INSERT INTO participants (session_id, display_name, role, socket_id) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(sessionId, displayName, role, socketId);
  return getDB().prepare('SELECT * FROM participants WHERE id = ?').get(result.lastInsertRowid);
}

function findBySocketId(socketId) {
  return getDB().prepare('SELECT * FROM participants WHERE socket_id = ?').get(socketId);
}

function findBySession(sessionId) {
  return getDB()
    .prepare('SELECT * FROM participants WHERE session_id = ? ORDER BY joined_at ASC')
    .all(sessionId);
}

function findActiveBySession(sessionId) {
  return getDB()
    .prepare('SELECT * FROM participants WHERE session_id = ? AND left_at IS NULL')
    .all(sessionId);
}

function markLeft(socketId) {
  return getDB()
    .prepare('UPDATE participants SET left_at = CURRENT_TIMESTAMP WHERE socket_id = ?')
    .run(socketId);
}

function countActive(sessionId) {
  return getDB()
    .prepare('SELECT COUNT(*) as count FROM participants WHERE session_id = ? AND left_at IS NULL')
    .get(sessionId).count;
}

module.exports = { add, findBySocketId, findBySession, findActiveBySession, markLeft, countActive };
