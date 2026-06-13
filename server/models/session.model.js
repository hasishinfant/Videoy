const { getDB } = require('../config/db');

function create({ sessionToken, createdBy }) {
  const stmt = getDB().prepare(
    'INSERT INTO sessions (session_token, created_by) VALUES (?, ?)'
  );
  const result = stmt.run(sessionToken, createdBy);
  return findById(result.lastInsertRowid);
}

function findById(id) {
  return getDB().prepare('SELECT * FROM sessions WHERE id = ?').get(id);
}

function findByToken(token) {
  return getDB().prepare('SELECT * FROM sessions WHERE session_token = ?').get(token);
}

function findByAgent(agentId, limit = 50) {
  return getDB()
    .prepare('SELECT * FROM sessions WHERE created_by = ? ORDER BY created_at DESC LIMIT ?')
    .all(agentId, limit);
}

function findAllActive() {
  return getDB()
    .prepare(`
      SELECT s.*, a.name as agent_name, a.email as agent_email,
        (SELECT COUNT(*) FROM participants p WHERE p.session_id = s.id AND p.left_at IS NULL) as participant_count
      FROM sessions s
      JOIN agents a ON a.id = s.created_by
      WHERE s.status = 'active'
      ORDER BY s.started_at DESC
    `)
    .all();
}

function findAll(limit = 100, offset = 0) {
  return getDB()
    .prepare(`
      SELECT s.*, a.name as agent_name,
        (SELECT COUNT(*) FROM participants p WHERE p.session_id = s.id) as total_participants
      FROM sessions s
      JOIN agents a ON a.id = s.created_by
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(limit, offset);
}

function updateStatus(token, status) {
  return getDB()
    .prepare('UPDATE sessions SET status = ? WHERE session_token = ?')
    .run(status, token);
}

function markStarted(token) {
  return getDB()
    .prepare("UPDATE sessions SET status = 'active', started_at = CURRENT_TIMESTAMP WHERE session_token = ?")
    .run(token);
}

function markEnded(token) {
  const session = findByToken(token);
  if (!session) return;
  const startedAt = session.started_at ? new Date(session.started_at) : new Date();
  const durationSecs = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  return getDB()
    .prepare(`
      UPDATE sessions 
      SET status = 'ended', ended_at = CURRENT_TIMESTAMP, duration_secs = ?
      WHERE session_token = ?
    `)
    .run(durationSecs, token);
}

function saveSummary(token, summaryJson) {
  return getDB()
    .prepare('UPDATE sessions SET ai_summary = ? WHERE session_token = ?')
    .run(summaryJson, token);
}

function countAll() {
  return getDB().prepare('SELECT COUNT(*) as count FROM sessions').get().count;
}

function countActive() {
  return getDB().prepare("SELECT COUNT(*) as count FROM sessions WHERE status = 'active'").get().count;
}

module.exports = {
  create, findById, findByToken, findByAgent,
  findAllActive, findAll, updateStatus, markStarted, markEnded, saveSummary,
  countAll, countActive
};
