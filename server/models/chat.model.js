const { getDB } = require('../config/db');

function add({ sessionId, senderName, senderRole, message }) {
  const stmt = getDB().prepare(
    'INSERT INTO chat_messages (session_id, sender_name, sender_role, message) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(sessionId, senderName, senderRole, message);
  return getDB().prepare('SELECT * FROM chat_messages WHERE id = ?').get(result.lastInsertRowid);
}

function findBySession(sessionId) {
  return getDB()
    .prepare('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY sent_at ASC')
    .all(sessionId);
}

module.exports = { add, findBySession };
