#!/usr/bin/env bash
# Run this from inside your cloned AVAtar/ repo folder
# Creates all Phase 1 files in place

set -e
echo "→ Creating directory structure..."
mkdir -p backend/src/db backend/src/middleware backend/src/routes backend/uploads backend/data frontend

echo "→ Writing files..."
cat > ".gitignore" << 'EOF_d508c7ff'
# Dependencies
node_modules/

# Database files
backend/data/
*.db
*.sqlite

# Uploads (keep folder, ignore contents)
backend/uploads/*
!backend/uploads/.gitkeep

# Environment — never commit real secrets
.env
!.env.example

# Logs
logs/
*.log
npm-debug.log*

# Frontend build output
frontend/dist/
frontend/.vite/

# OS artifacts
.DS_Store
Thumbs.db

# Editor
.vscode/settings.json
.idea/
EOF_d508c7ff

cat > "README.md" << 'EOF_ac036608'
# AVAtar — Lagerverwaltung

> Lokales Inventarsystem für AV-Systemintegratoren · Teil des AVA-Ökosystems

---

## Stack

| Schicht | Technologie |
|---|---|
| Backend | Node.js · Express · SQLite (better-sqlite3) |
| Frontend | Vue 3 · Vite · Pinia · Tailwind CSS |
| Auth | JWT (lokal, kein Cloud-Zwang) |
| Deployment | LAN-Server (Linux) · Browserzugriff |

---

## Erste Schritte

### Voraussetzungen

- Node.js ≥ 20 LTS
- npm ≥ 10

### Backend starten

```bash
cd backend
cp .env.example .env        # Werte anpassen
npm install
npm run dev
```

Der Server läuft auf **http://localhost:3000**  
Gesundheitscheck: `GET /api/health`

### Erster Login

Der erste Admin-User wird beim ersten Start automatisch angelegt —  
Zugangsdaten aus `.env` (`ADMIN_USERNAME`, `ADMIN_PASSWORD`).  
**Passwort nach dem ersten Login ändern.**

---

## Projektstruktur

```
avatar/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.sql        # Vollständiges SQLite-Schema
│   │   │   └── init.js           # DB-Verbindung & Schema-Runner
│   │   ├── middleware/
│   │   │   ├── errorHandler.js
│   │   │   └── requestLogger.js
│   │   ├── routes/
│   │   │   └── health.js
│   │   ├── config.js
│   │   └── index.js              # Express-Einstiegspunkt
│   ├── uploads/                  # Artikelbilder (gitignored)
│   ├── data/                     # SQLite-DB (gitignored)
│   └── .env.example
└── frontend/                     # Vue 3 (Phase 7+)
```

---

## Roadmap

| Phase | Inhalt | Status |
|---|---|---|
| 1 | DB-Schema + Express-Grundgerüst | ✅ |
| 2 | JWT-Authentifizierung + Rollen | ⬜ |
| 3 | Artikel-API (CRUD + Barcode-Lookup) | ⬜ |
| 4 | Bewegungs-API (Eingang/Ausgang) | ⬜ |
| 5 | Verleih-API + Seriennummern | ⬜ |
| 6 | E-Mail-Benachrichtigungen | ⬜ |
| 7 | Frontend Setup (Vue 3 + Vite) | ⬜ |
| 8 | Staff UI (Touch/Tablet) | ⬜ |
| 9 | Admin UI (Dashboard + Tabellen) | ⬜ |
| 10 | Benutzerverwaltung + Settings | ⬜ |
| 11 | Polish + Deployment | ⬜ |

---

## Artikeltypen

| Typ | Schlüssel | Einheit |
|---|---|---|
| Verbrauchsartikel | `consumable` | Stück |
| Gebinde | `bundle` | Set |
| Gerät | `equipment` | Stück · Seriennummer |
| Verleihgerät | `rental` | Stück · Seriennummer · Checkout |
| Kabelware | `cable` | Meter |

---

*AVAtar ist Teil des AVA-Ökosystems (AVACONDA, AVAtar).*
EOF_ac036608

cat > "backend/.env.example" << 'EOF_ab784fda'
# ─── Server ────────────────────────────────────────────────────────────────────
PORT=3000
NODE_ENV=development

# ─── JWT ───────────────────────────────────────────────────────────────────────
# WICHTIG: In Produktion durch einen langen Zufallsstring ersetzen
# Generieren: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=change_this_to_a_long_random_string_in_production
JWT_EXPIRES_IN=8h

# ─── Datenbank ─────────────────────────────────────────────────────────────────
DB_PATH=./data/avatar.db

# ─── Erster Admin-User (nur beim ersten Start verwendet) ───────────────────────
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=changeme123

# ─── Datei-Upload ──────────────────────────────────────────────────────────────
UPLOADS_DIR=./uploads
MAX_FILE_SIZE_MB=5

# ─── E-Mail / Nodemailer (für Mindestbestand-Warnungen) ────────────────────────
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=avatar@example.com

# ─── CORS (Produktions-URL des Frontends) ──────────────────────────────────────
# Nur in production relevant; in development wird '*' erlaubt
CORS_ORIGIN=http://192.168.1.100:5173
EOF_ab784fda

cat > "backend/package.json" << 'EOF_8e2fe42c'
{
  "name": "avatar-backend",
  "version": "0.1.0",
  "description": "AVAtar Lagerverwaltung – Backend API",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "better-sqlite3": "^9.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.18.3",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "nodemailer": "^6.9.13"
  }
}
EOF_8e2fe42c

cat > "backend/src/config.js" << 'EOF_1205e36e'
require('dotenv').config();

const config = {
  port:    parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev:   (process.env.NODE_ENV || 'development') === 'development',

  jwt: {
    secret:    process.env.JWT_SECRET    || 'dev-secret-CHANGE-IN-PRODUCTION',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  db: {
    path: process.env.DB_PATH || './data/avatar.db',
  },

  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    email:    process.env.ADMIN_EMAIL    || 'admin@local.host',
    password: process.env.ADMIN_PASSWORD || 'changeme123',
  },

  uploads: {
    dir:       process.env.UPLOADS_DIR        || './uploads',
    maxSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10),
  },

  smtp: {
    host:   process.env.SMTP_HOST   || '',
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user:   process.env.SMTP_USER   || '',
    pass:   process.env.SMTP_PASS   || '',
    from:   process.env.SMTP_FROM   || 'avatar@local.host',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
};

// Hard-fail in production if the JWT secret was never changed
if (!config.isDev && config.jwt.secret === 'dev-secret-CHANGE-IN-PRODUCTION') {
  console.error('[CONFIG] FATAL: JWT_SECRET must be set to a strong secret in production.');
  process.exit(1);
}

module.exports = config;
EOF_1205e36e

cat > "backend/src/index.js" << 'EOF_57369da3'
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const config                            = require('./config');
const { initDb, closeDb }               = require('./db/init');
const { requestLogger }                 = require('./middleware/requestLogger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const healthRouter                      = require('./routes/health');

// ─── Bootstrap ───────────────────────────────────────────────────────────────

function createApp() {
  const app = express();

  // ── Core middleware ────────────────────────────────────────────────────────
  app.use(cors({
    origin:      config.isDev ? '*' : config.cors.origin,
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  // ── Static: uploaded article images ───────────────────────────────────────
  app.use('/uploads', express.static(path.resolve(config.uploads.dir)));

  // ── API Routes ─────────────────────────────────────────────────────────────
  app.use('/api/health', healthRouter);

  // Phase 2+: auth, articles, movements, rentals will be added here
  // app.use('/api/auth',      authRouter);
  // app.use('/api/articles',  articlesRouter);
  // app.use('/api/movements', movementsRouter);
  // app.use('/api/rentals',   rentalsRouter);
  // app.use('/api/users',     usersRouter);

  // ── Catch-all handlers (must be last) ─────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

// ─── Start ───────────────────────────────────────────────────────────────────

function start() {
  initDb();

  const app    = createApp();
  const server = app.listen(config.port, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════╗');
    console.log('  ║         AVAtar — Lagerverwaltung     ║');
    console.log('  ╚══════════════════════════════════════╝');
    console.log('');
    console.log(`  Server  →  http://localhost:${config.port}`);
    console.log(`  Health  →  http://localhost:${config.port}/api/health`);
    console.log(`  Mode    →  ${config.nodeEnv}`);
    console.log('');
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  function shutdown(signal) {
    console.log(`\n[AVAtar] ${signal} received — shutting down gracefully...`);
    server.close(() => {
      closeDb();
      console.log('[AVAtar] Bye.');
      process.exit(0);
    });

    // Force exit after 10 s if connections don't drain
    setTimeout(() => {
      console.error('[AVAtar] Forced exit after timeout');
      process.exit(1);
    }, 10_000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    console.error('[AVAtar] Uncaught exception:', err);
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[AVAtar] Unhandled rejection:', reason);
  });
}

start();
EOF_57369da3

cat > "backend/src/db/schema.sql" << 'EOF_cf79efd6'
-- ─────────────────────────────────────────────────────────────────────────────
-- AVAtar · Datenbankschema
-- SQLite via better-sqlite3
-- ─────────────────────────────────────────────────────────────────────────────
-- Hinweis: PRAGMA-Befehle werden in init.js gesetzt (nicht hier),
-- da sie pro Verbindung gelten und nicht in exec()-Batches zuverlässig laufen.

-- ─── Benutzer ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'staff'
                        CHECK (role IN ('staff', 'warehouse_manager', 'admin')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ─── Kategorien ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ─── Lieferanten ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  contact_person TEXT,
  email          TEXT,
  phone          TEXT,
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ─── Artikel ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS articles (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  article_number TEXT    NOT NULL UNIQUE,               -- ART-001, ART-002 …
  barcode        TEXT    UNIQUE,                         -- EAN / QR-Code-Inhalt
  name           TEXT    NOT NULL,
  description    TEXT,
  type           TEXT    NOT NULL
                         CHECK (type IN ('consumable','bundle','equipment','rental','cable')),
  category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id    INTEGER REFERENCES suppliers(id)  ON DELETE SET NULL,
  purchase_price REAL,
  stock_qty      INTEGER NOT NULL DEFAULT 0,             -- für Stück-Artikel
  stock_meters   REAL    NOT NULL DEFAULT 0,             -- für Kabelware
  min_stock      REAL    NOT NULL DEFAULT 0,             -- Schwellwert (Stk. oder m)
  bundle_size    INTEGER,                                -- Stück pro Gebinde-Einheit
  unit           TEXT    NOT NULL DEFAULT 'piece'
                         CHECK (unit IN ('piece','meter','bundle')),
  location       TEXT,                                   -- Regal / Fachboden / Raum
  image_path     TEXT,
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ─── Seriennummern (nur equipment & rental) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS serial_numbers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id    INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  serial_number TEXT    NOT NULL UNIQUE,
  status        TEXT    NOT NULL DEFAULT 'available'
                        CHECK (status IN ('available','rented','maintenance','retired')),
  notes         TEXT,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ─── Verleihe ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rentals (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  serial_number_id   INTEGER NOT NULL REFERENCES serial_numbers(id),
  article_id         INTEGER NOT NULL REFERENCES articles(id),
  rented_by_user_id  INTEGER NOT NULL REFERENCES users(id),
  rented_to          TEXT    NOT NULL,                    -- Name / Firma (Freitext)
  rented_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  expected_return    TEXT,
  returned_at        TEXT,                                -- NULL = noch unterwegs
  notes              TEXT,
  created_by         INTEGER NOT NULL REFERENCES users(id)
);

-- ─── Lagerbewegungen ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movements (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id       INTEGER NOT NULL REFERENCES articles(id),
  serial_number_id INTEGER          REFERENCES serial_numbers(id),  -- nullable
  type             TEXT    NOT NULL
                           CHECK (type IN ('in','out','rental_out','rental_in','correction')),
  qty              INTEGER NOT NULL DEFAULT 0,            -- Stück
  meters           REAL    NOT NULL DEFAULT 0,            -- Kabelware
  user_id          INTEGER NOT NULL REFERENCES users(id),
  reference        TEXT,                                  -- Projektnr., Auftragsnr., etc.
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ─── Trigger: articles.updated_at automatisch setzen ─────────────────────────
CREATE TRIGGER IF NOT EXISTS trg_articles_updated_at
AFTER UPDATE ON articles
BEGIN
  UPDATE articles
  SET    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
  WHERE  id = NEW.id;
END;

-- ─── Indizes für häufige Abfragen ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_articles_barcode      ON articles(barcode);
CREATE INDEX IF NOT EXISTS idx_articles_type         ON articles(type);
CREATE INDEX IF NOT EXISTS idx_articles_active       ON articles(active);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_status ON serial_numbers(status);
CREATE INDEX IF NOT EXISTS idx_movements_article_id  ON movements(article_id);
CREATE INDEX IF NOT EXISTS idx_movements_created_at  ON movements(created_at);
CREATE INDEX IF NOT EXISTS idx_rentals_returned_at   ON rentals(returned_at);
EOF_cf79efd6

cat > "backend/src/db/init.js" << 'EOF_76e21a2d'
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

  _seedAdmin();

  console.log(`[DB] Ready — ${dbPath}`);
  return db;
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
EOF_76e21a2d

cat > "backend/src/middleware/errorHandler.js" << 'EOF_f2f64c89'
const config = require('../config');

/**
 * 404 handler — must be registered AFTER all routes.
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error:  'Not found',
    path:   req.originalUrl,
    method: req.method,
  });
}

/**
 * Centralised error handler.
 * Express recognises this as an error handler because it has 4 parameters.
 *
 * Usage in routes:  next(err)  or  next(createError(400, 'Bad input'))
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Always log 5xx errors server-side
  if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl} — ${message}`);
    console.error(err.stack);
  }

  res.status(status).json({
    error: message,
    // Only expose stack trace in development
    ...(config.isDev && err.stack ? { stack: err.stack } : {}),
  });
}

/**
 * Helper: create an error with an HTTP status code.
 *
 * @param {number} status
 * @param {string} message
 * @returns {Error}
 */
function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = { notFoundHandler, errorHandler, createError };
EOF_f2f64c89

cat > "backend/src/middleware/requestLogger.js" << 'EOF_851aced4'
const RESET  = '\x1b[0m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';

/**
 * Minimal request logger — no external dependency.
 * Logs: METHOD /path STATUS Xms
 */
function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const ms     = Date.now() - start;
    const status = res.statusCode;
    const color  = status >= 500 ? RED
                 : status >= 400 ? YELLOW
                 : status >= 200 ? GREEN
                 : CYAN;

    const ts = new Date().toISOString().slice(11, 19); // HH:MM:SS
    console.log(
      `${DIM}${ts}${RESET} ${color}${req.method.padEnd(6)}${RESET}` +
      ` ${req.originalUrl.padEnd(40)} ${color}${status}${RESET}` +
      ` ${DIM}${ms}ms${RESET}`
    );
  });

  next();
}

module.exports = { requestLogger };
EOF_851aced4

cat > "backend/src/routes/health.js" << 'EOF_2e19ac19'
const router = require('express').Router();
const { getDb } = require('../db/init');

/**
 * GET /api/health
 * Returns server status and a lightweight DB probe.
 * Useful for monitoring and as a smoke-test after deploy.
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();

    // Lightweight probe — one indexed read per core table
    const { user_count }     = db.prepare('SELECT COUNT(*) AS user_count FROM users').get();
    const { article_count }  = db.prepare('SELECT COUNT(*) AS article_count FROM articles').get();
    const { movement_count } = db.prepare('SELECT COUNT(*) AS movement_count FROM movements').get();

    res.json({
      status:    'ok',
      project:   'AVAtar',
      version:   '0.1.0',
      timestamp: new Date().toISOString(),
      db: {
        status:    'ok',
        users:     user_count,
        articles:  article_count,
        movements: movement_count,
      },
    });
  } catch (err) {
    res.status(503).json({
      status:  'error',
      message: err.message,
    });
  }
});

module.exports = router;
EOF_2e19ac19

touch backend/uploads/.gitkeep backend/data/.gitkeep frontend/.gitkeep

echo ""
echo "✓ All files created."
echo ""
echo "Next steps:"
echo "  cd backend && npm install"
echo "  cd .."
echo "  git add ."
echo "  git commit -m 'feat: Phase 1 — DB schema + Express skeleton'"
echo "  git push"
