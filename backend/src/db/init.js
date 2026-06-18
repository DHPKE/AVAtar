const Database = require('better-sqlite3');
const fs       = require('fs');
const path     = require('path');
const bcrypt   = require('bcryptjs');
const config   = require('../config');

/** @type {import('better-sqlite3').Database|null} */
let db = null;

/**
 * Returns the active DB instance.
 * Throws if initDb() has not been called yet.
 */
function getDb() {
  if (!db) throw new Error('Database not initialised — call initDb() first.');
  return db;
}

/**
 * Opens (or creates) the SQLite database, runs the schema,
 * and seeds the initial admin user on first run.
 */
function initDb() {
  const dbPath = path.resolve(config.db.path);
  const dbDir  = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);

  // Per-connection PRAGMAs
  db.pragma('journal_mode = WAL');   // better write concurrency
  db.pragma('foreign_keys = ON');    // enforce FK constraints
  db.pragma('synchronous = NORMAL'); // safe with WAL, faster than FULL

  // Run schema (idempotent — uses IF NOT EXISTS everywhere)
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  _migrateSchema();
  _seedAdmin();

  console.log(`[DB] Ready — ${dbPath}`);
  return db;
}

/**
 * Generic helper — adds a column if it doesn't already exist.
 * SQLite has no "ADD COLUMN IF NOT EXISTS", so we check PRAGMA table_info first.
 */
function _ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`[DB] Migration: ${table}.${column} hinzugefügt`);
  }
}

/**
 * Upgrades databases created before the Kürzel-Login (shortcode) and
 * PIN-Login features existed. Safe to run on every startup — no-op if
 * the columns already exist.
 */
function _migrateSchema() {
  _ensureColumn('users', 'shortcode', 'TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_shortcode ON users(shortcode)');
  _ensureColumn('users', 'pin_hash', 'TEXT');
}

/**
 * Creates the initial admin user if no users exist yet.
 * Credentials come from .env (ADMIN_USERNAME / ADMIN_EMAIL / ADMIN_PASSWORD).
 */
function _seedAdmin() {
  const existing = db.prepare('SELECT id FROM users LIMIT 1').get();
  if (existing) return;

  const hash = bcrypt.hashSync(config.admin.password, 12);

  db.prepare(`
    INSERT INTO users (username, email, password_hash, role)
    VALUES (?, ?, ?, 'admin')
  `).run(config.admin.username, config.admin.email, hash);

  console.log(`[DB] Admin user created — username: "${config.admin.username}"`);
  console.log('[DB] ⚠  Change the admin password after first login!');
}

/**
 * Closes the database connection gracefully.
 * Call this on SIGTERM / SIGINT.
 */
function closeDb() {
  if (db && db.open) {
    db.close();
    db = null;
    console.log('[DB] Connection closed');
  }
}

module.exports = { initDb, getDb, closeDb };
