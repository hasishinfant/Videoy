const { getDB } = require('../config/db');

function findByEmail(email) {
  return getDB().prepare('SELECT * FROM agents WHERE email = ?').get(email);
}

function findById(id) {
  return getDB().prepare('SELECT id, name, email, role, created_at FROM agents WHERE id = ?').get(id);
}

function create({ name, email, passwordHash, role = 'agent' }) {
  const stmt = getDB().prepare(
    'INSERT INTO agents (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(name, email, passwordHash, role);
  return findById(result.lastInsertRowid);
}

function list() {
  return getDB().prepare('SELECT id, name, email, role, created_at FROM agents').all();
}

module.exports = { findByEmail, findById, create, list };
