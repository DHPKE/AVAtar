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
  _migrateArticlesTypeCheck();
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
 * Upgrades databases created before various features existed.
 * Safe to run on every startup — no-op if columns already exist.
 */
function _migrateSchema() {
  // Kürzel-Login / PIN-Login
  _ensureColumn('users', 'shortcode', 'TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_shortcode ON users(shortcode)');
  _ensureColumn('users', 'pin_hash', 'TEXT');

  // Benutzer: Abteilung
  _ensureColumn('users', 'department', 'TEXT');

  // Lieferanten: erweiterte Adress-/Konditionsfelder
  _ensureColumn('suppliers', 'street',      'TEXT');
  _ensureColumn('suppliers', 'postal_code', 'TEXT');
  _ensureColumn('suppliers', 'city',        'TEXT');
  _ensureColumn('suppliers', 'country',     'TEXT');
  _ensureColumn('suppliers', 'conditions',  'TEXT');

  // Artikel: Gruppe + aufgesplitteter Lagerort
  _ensureColumn('articles', 'group_id',       'INTEGER REFERENCES groups(id) ON DELETE SET NULL');
  _ensureColumn('articles', 'location_row',   'TEXT');
  _ensureColumn('articles', 'location_shelf', 'TEXT');
  _ensureColumn('articles', 'location_bin',   'TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS idx_articles_group_id ON articles(group_id)');

  // Lagerbewegungen: Verknüpfung zusammengehöriger Buchungen (Sammelartikel)
  _ensureColumn('movements', 'group_ref', 'TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS idx_movements_group_ref ON movements(group_ref)');
}

/**
 * SQLite cannot ALTER a CHECK constraint in place. To allow the new
 * 'sammelartikel' article type on databases created before it existed,
 * we rebuild the articles table (standard SQLite 12-step procedure)
 * if the stored CREATE TABLE statement doesn't already mention it.
 * No-op (and safe) on fresh installs, since schema.sql already includes it.
 */
function _migrateArticlesTypeCheck() {
  const row = db.prepare(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='articles'`
  ).get();
  if (!row || row.sql.includes('sammelartikel')) return; // already up to date

  console.log('[DB] Migration: articles.type CHECK wird erweitert (sammelartikel)…');

  db.pragma('foreign_keys = OFF');
  const run = db.transaction(() => {
    db.exec(`
      CREATE TABLE articles_migrate_new (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        article_number TEXT    NOT NULL UNIQUE,
        barcode        TEXT    UNIQUE,
        name           TEXT    NOT NULL,
        description    TEXT,
        type           TEXT    NOT NULL
                               CHECK (type IN ('consumable','bundle','equipment','rental','cable','sammelartikel')),
        category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        group_id       INTEGER REFERENCES groups(id)     ON DELETE SET NULL,
        supplier_id    INTEGER REFERENCES suppliers(id)  ON DELETE SET NULL,
        purchase_price REAL,
        stock_qty      INTEGER NOT NULL DEFAULT 0,
        stock_meters   REAL    NOT NULL DEFAULT 0,
        min_stock      REAL    NOT NULL DEFAULT 0,
        bundle_size    INTEGER,
        unit           TEXT    NOT NULL DEFAULT 'piece'
                               CHECK (unit IN ('piece','meter','bundle')),
        location       TEXT,
        location_row   TEXT,
        location_shelf TEXT,
        location_bin   TEXT,
        image_path     TEXT,
        active         INTEGER NOT NULL DEFAULT 1,
        created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        updated_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      INSERT INTO articles_migrate_new
        (id, article_number, barcode, name, description, type,
         category_id, group_id, supplier_id, purchase_price,
         stock_qty, stock_meters, min_stock, bundle_size, unit,
         location, location_row, location_shelf, location_bin,
         image_path, active, created_at, updated_at)
      SELECT
        id, article_number, barcode, name, description, type,
        category_id, group_id, supplier_id, purchase_price,
        stock_qty, stock_meters, min_stock, bundle_size, unit,
        location, location_row, location_shelf, location_bin,
        image_path, active, created_at, updated_at
      FROM articles;

      DROP TABLE articles;
      ALTER TABLE articles_migrate_new RENAME TO articles;

      CREATE TRIGGER IF NOT EXISTS trg_articles_updated_at
      AFTER UPDATE ON articles
      BEGIN
        UPDATE articles SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = NEW.id;
      END;

      CREATE INDEX IF NOT EXISTS idx_articles_barcode  ON articles(barcode);
      CREATE INDEX IF NOT EXISTS idx_articles_type     ON articles(type);
      CREATE INDEX IF NOT EXISTS idx_articles_active   ON articles(active);
      CREATE INDEX IF NOT EXISTS idx_articles_group_id ON articles(group_id);
    `);
  });
  run();
  db.pragma('foreign_keys = ON');

  console.log('[DB] Migration abgeschlossen — Sammelartikel verfügbar.');
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
