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

-- ─── Einstellungen (Key-Value Store) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
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
