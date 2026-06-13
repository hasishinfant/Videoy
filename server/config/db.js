const Database = require('better-sqlite3');
const path = require('path');
const logger = require('../utils/logger');

const DB_PATH = path.join(__dirname, '..', 'data', 'supportvision.db');
let db;

function getDB() {
  if (!db) throw new Error('Database not initialized. Call initDB() first.');
  return db;
}

function initDB() {
  const fs = require('fs');
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  logger.info(`SQLite connected: ${DB_PATH}`);
  return db;
}

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      email         TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'agent',
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      session_token   TEXT    NOT NULL UNIQUE,
      created_by      INTEGER NOT NULL REFERENCES agents(id),
      status          TEXT    NOT NULL DEFAULT 'waiting',
      started_at      DATETIME,
      ended_at        DATETIME,
      duration_secs   INTEGER,
      recording_path  TEXT,
      ai_summary      TEXT,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS participants (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id    INTEGER NOT NULL REFERENCES sessions(id),
      display_name  TEXT    NOT NULL,
      role          TEXT    NOT NULL,
      socket_id     TEXT,
      joined_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      left_at       DATETIME
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   INTEGER NOT NULL REFERENCES sessions(id),
      sender_name  TEXT    NOT NULL,
      sender_role  TEXT    NOT NULL,
      message      TEXT    NOT NULL,
      sent_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vision_detections (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id       INTEGER NOT NULL REFERENCES sessions(id),
      detected_product TEXT,
      detected_issue   TEXT,
      confidence       INTEGER,
      raw_response     TEXT,
      detected_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_summaries (
      id                      INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id              INTEGER NOT NULL UNIQUE REFERENCES sessions(id),
      issue_identified        TEXT,
      product_detected        TEXT,
      resolution_steps        TEXT,
      resolution_status       TEXT DEFAULT 'unresolved',
      action_items            TEXT,
      agent_performance_score INTEGER,
      created_at              DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token      ON sessions(session_token);
    CREATE INDEX IF NOT EXISTS idx_sessions_status     ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_participants_sess   ON participants(session_id);
    CREATE INDEX IF NOT EXISTS idx_chat_session        ON chat_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_vision_session      ON vision_detections(session_id);
    CREATE INDEX IF NOT EXISTS idx_summaries_session   ON ai_summaries(session_id);
    CREATE INDEX IF NOT EXISTS idx_summaries_status    ON ai_summaries(resolution_status);
  `);
}

module.exports = { initDB, getDB };
