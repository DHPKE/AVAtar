const router = require('express').Router();
const path   = require('path');
const fs     = require('fs');
const QRCode = require('qrcode');
const config = require('../config');
const { getDb }           = require('../db/init');
const { authenticate }    = require('../middleware/authenticate');
const { requireMinRole }  = require('../middleware/requireRole');
const { createError }     = require('../middleware/errorHandler');
const upload              = require('../middleware/upload');

router.use(authenticate);

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_TYPES = ['consumable', 'bundle', 'equipment', 'rental', 'cable'];
const VALID_UNITS = ['piece', 'meter', 'bundle'];

/** Base SELECT — always joins category & supplier names */
const BASE_SELECT = `
  SELECT
    a.*,
    c.name AS category_name,
    s.name AS supplier_name
  FROM articles a
  LEFT JOIN categories c ON a.category_id = c.id
  LEFT JOIN suppliers  s ON a.supplier_id  = s.id
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Auto-generate next ART-XXX number (safe for SQLite single-writer) */
function nextArticleNumber(db) {
  const { n } = db.prepare(`
    SELECT COALESCE(MAX(CAST(SUBSTR(article_number, 5) AS INTEGER)), 0) AS n
    FROM articles WHERE article_number LIKE 'ART-%'
  `).get();
  return `ART-${String(n + 1).padStart(3, '0')}`;
}

/** Derive sensible unit default from article type */
function defaultUnit(type) {
  if (type === 'cable')  return 'meter';
  if (type === 'bundle') return 'bundle';
  return 'piece';
}

/** For equipment & rental: attach serial numbers to article object */
function withSerials(db, article) {
  if (!['equipment', 'rental'].includes(article.type)) return article;
  const serials = db.prepare(
    'SELECT * FROM serial_numbers WHERE article_id = ? ORDER BY serial_number'
  ).all(article.id);
  return { ...article, serials };
}

// ─── GET /api/articles ────────────────────────────────────────────────────────
router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const {
      type, category_id, active = '1',
      search, low_stock,
      limit = '50', offset = '0',
    } = req.query;

    const conds  = [];
    const params = [];

    if (active !== 'all') {
      conds.push('a.active = ?');
      params.push(active === '0' ? 0 : 1);
    }
    if (type) {
      if (!VALID_TYPES.includes(type)) return next(createError(400, 'Ungültiger Typ'));
      conds.push('a.type = ?');
      params.push(type);
    }
    if (category_id) {
      conds.push('a.category_id = ?');
      params.push(Number(category_id));
    }
    if (search?.trim()) {
      conds.push('(a.name LIKE ? OR a.article_number LIKE ? OR a.barcode LIKE ?)');
      const t = `%${search.trim()}%`;
      params.push(t, t, t);
    }
    if (low_stock === '1') {
      conds.push(`(
        (a.unit = 'meter'  AND a.stock_meters <= a.min_stock) OR
        (a.unit != 'meter' AND a.stock_qty    <= a.min_stock)
      )`);
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const lim   = Math.min(Number(limit) || 50, 200);
    const off   = Number(offset) || 0;

    const articles = db.prepare(
      `${BASE_SELECT} ${where} ORDER BY a.name LIMIT ? OFFSET ?`
    ).all(...params, lim, off);

    const { total } = db.prepare(
      `SELECT COUNT(*) AS total FROM articles a ${where}`
    ).get(...params);

    res.json({ articles, total, limit: lim, offset: off });
  } catch (err) { next(err); }
});

// ─── GET /api/articles/barcode/:barcode  ← scan-workflow entry point ──────────
router.get('/barcode/:barcode', (req, res, next) => {
  try {
    const db      = getDb();
    const article = db.prepare(
      `${BASE_SELECT} WHERE a.barcode = ? AND a.active = 1`
    ).get(req.params.barcode);

    if (!article) {
      return next(createError(404, `Kein Artikel mit Barcode "${req.params.barcode}"`));
    }

    res.json(withSerials(db, article));
  } catch (err) { next(err); }
});

// ─── GET /api/articles/:id ────────────────────────────────────────────────────
router.get('/:id', (req, res, next) => {
  try {
    const db      = getDb();
    const article = db.prepare(`${BASE_SELECT} WHERE a.id = ?`).get(req.params.id);
    if (!article) return next(createError(404, 'Artikel nicht gefunden'));
    res.json(withSerials(db, article));
  } catch (err) { next(err); }
});

// ─── POST /api/articles  (warehouse_manager+) ─────────────────────────────────
router.post('/', requireMinRole('warehouse_manager'), (req, res, next) => {
  try {
    const {
      barcode, name, description, type,
      category_id, supplier_id, purchase_price,
      stock_qty = 0, stock_meters = 0, min_stock = 0,
      bundle_size, unit, location,
    } = req.body;

    if (!name?.trim())  return next(createError(400, 'Name erforderlich'));
    if (!type)          return next(createError(400, 'Typ erforderlich'));
    if (!VALID_TYPES.includes(type)) {
      return next(createError(400, `Ungültiger Typ. Erlaubt: ${VALID_TYPES.join(', ')}`));
    }

    const resolvedUnit = unit ?? defaultUnit(type);
    if (!VALID_UNITS.includes(resolvedUnit)) {
      return next(createError(400, `Ungültige Einheit. Erlaubt: ${VALID_UNITS.join(', ')}`));
    }

    const db             = getDb();
    const article_number = nextArticleNumber(db);

    const { lastInsertRowid } = db.prepare(`
      INSERT INTO articles
        (article_number, barcode, name, description, type,
         category_id, supplier_id, purchase_price,
         stock_qty, stock_meters, min_stock,
         bundle_size, unit, location)
      VALUES (?,?,?,?,?, ?,?,?, ?,?,?, ?,?,?)
    `).run(
      article_number,
      barcode?.trim()     || null,
      name.trim(),
      description?.trim() || null,
      type,
      category_id         || null,
      supplier_id         || null,
      purchase_price      ?? null,
      Number(stock_qty),
      Number(stock_meters),
      Number(min_stock),
      bundle_size         || null,
      resolvedUnit,
      location?.trim()    || null,
    );

    const article = db.prepare(`${BASE_SELECT} WHERE a.id = ?`).get(lastInsertRowid);
    res.status(201).json({ article });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint failed: articles.barcode')) {
      return next(createError(409, 'Barcode bereits vergeben'));
    }
    next(err);
  }
});

// ─── PUT /api/articles/:id  (warehouse_manager+) ──────────────────────────────
// Note: stock_qty / stock_meters are intentionally excluded — use Bewegungen (Phase 4)
router.put('/:id', requireMinRole('warehouse_manager'), (req, res, next) => {
  try {
    const db      = getDb();
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
    if (!article) return next(createError(404, 'Artikel nicht gefunden'));

    const {
      barcode, name, description, type,
      category_id, supplier_id, purchase_price,
      min_stock, bundle_size, unit, location, active,
    } = req.body;

    if (type && !VALID_TYPES.includes(type)) {
      return next(createError(400, `Ungültiger Typ. Erlaubt: ${VALID_TYPES.join(', ')}`));
    }
    if (unit && !VALID_UNITS.includes(unit)) {
      return next(createError(400, `Ungültige Einheit. Erlaubt: ${VALID_UNITS.join(', ')}`));
    }

    db.prepare(`
      UPDATE articles SET
        barcode        = ?,
        name           = ?,
        description    = ?,
        type           = ?,
        category_id    = ?,
        supplier_id    = ?,
        purchase_price = ?,
        min_stock      = ?,
        bundle_size    = ?,
        unit           = ?,
        location       = ?,
        active         = ?
      WHERE id = ?
    `).run(
      barcode        !== undefined ? (barcode?.trim() || null) : article.barcode,
      name?.trim()          ?? article.name,
      description           !== undefined ? (description?.trim() || null) : article.description,
      type                  ?? article.type,
      category_id           !== undefined ? (category_id || null) : article.category_id,
      supplier_id           !== undefined ? (supplier_id || null) : article.supplier_id,
      purchase_price        !== undefined ? purchase_price : article.purchase_price,
      min_stock             !== undefined ? Number(min_stock) : article.min_stock,
      bundle_size           !== undefined ? (bundle_size || null) : article.bundle_size,
      unit                  ?? article.unit,
      location              !== undefined ? (location?.trim() || null) : article.location,
      active                !== undefined ? (active ? 1 : 0) : article.active,
      article.id,
    );

    const updated = db.prepare(`${BASE_SELECT} WHERE a.id = ?`).get(article.id);
    res.json({ article: updated });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint failed: articles.barcode')) {
      return next(createError(409, 'Barcode bereits vergeben'));
    }
    next(err);
  }
});

// ─── DELETE /api/articles/:id  → soft-delete (admin only) ────────────────────
router.delete('/:id', requireMinRole('admin'), (req, res, next) => {
  try {
    const db      = getDb();
    const article = db.prepare('SELECT id FROM articles WHERE id = ?').get(req.params.id);
    if (!article) return next(createError(404, 'Artikel nicht gefunden'));

    db.prepare('UPDATE articles SET active = 0 WHERE id = ?').run(article.id);
    res.json({ message: 'Artikel deaktiviert' });
  } catch (err) { next(err); }
});

// ─── POST /api/articles/:id/image  (warehouse_manager+) ──────────────────────
router.post(
  '/:id/image',
  requireMinRole('warehouse_manager'),
  upload.single('image'),
  (req, res, next) => {
    try {
      if (!req.file) return next(createError(400, 'Keine Datei hochgeladen'));

      const db      = getDb();
      const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);

      if (!article) {
        fs.unlinkSync(req.file.path); // clean up orphan
        return next(createError(404, 'Artikel nicht gefunden'));
      }

      // Remove old image from disk
      if (article.image_path) {
        const old = path.join(path.resolve(config.uploads.dir), article.image_path);
        if (fs.existsSync(old)) fs.unlinkSync(old);
      }

      db.prepare('UPDATE articles SET image_path = ? WHERE id = ?')
        .run(req.file.filename, article.id);

      res.json({
        image_path: req.file.filename,
        url:        `/uploads/${req.file.filename}`,
      });
    } catch (err) { next(err); }
  }
);

// ─── Serial numbers (equipment & rental) ─────────────────────────────────────

// POST /api/articles/:id/serials  (warehouse_manager+)
router.post('/:id/serials', requireMinRole('warehouse_manager'), (req, res, next) => {
  try {
    const db      = getDb();
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
    if (!article) return next(createError(404, 'Artikel nicht gefunden'));

    if (!['equipment', 'rental'].includes(article.type)) {
      return next(createError(400, 'Seriennummern nur für Gerät und Verleihgerät'));
    }

    const { serial_number, notes } = req.body;
    if (!serial_number?.trim()) return next(createError(400, 'Seriennummer erforderlich'));

    const { lastInsertRowid } = db.prepare(
      'INSERT INTO serial_numbers (article_id, serial_number, notes) VALUES (?, ?, ?)'
    ).run(article.id, serial_number.trim(), notes?.trim() || null);

    const sn = db.prepare('SELECT * FROM serial_numbers WHERE id = ?').get(lastInsertRowid);
    res.status(201).json({ serial_number: sn });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      return next(createError(409, 'Seriennummer bereits vorhanden'));
    }
    next(err);
  }
});

// PUT /api/articles/:id/serials/:snId  — update status/notes (warehouse_manager+)
router.put('/:id/serials/:snId', requireMinRole('warehouse_manager'), (req, res, next) => {
  try {
    const VALID_STATUSES = ['available', 'rented', 'maintenance', 'retired'];
    const db = getDb();
    const sn = db.prepare(
      'SELECT * FROM serial_numbers WHERE id = ? AND article_id = ?'
    ).get(req.params.snId, req.params.id);

    if (!sn) return next(createError(404, 'Seriennummer nicht gefunden'));

    const { status, notes } = req.body;
    if (status && !VALID_STATUSES.includes(status)) {
      return next(createError(400, `Ungültiger Status. Erlaubt: ${VALID_STATUSES.join(', ')}`));
    }

    db.prepare('UPDATE serial_numbers SET status = ?, notes = ? WHERE id = ?').run(
      status ?? sn.status,
      notes  !== undefined ? (notes?.trim() || null) : sn.notes,
      sn.id,
    );

    const updated = db.prepare('SELECT * FROM serial_numbers WHERE id = ?').get(sn.id);
    res.json({ serial_number: updated });
  } catch (err) { next(err); }
});

// ─── GET /api/articles/:id/qrcode.svg ────────────────────────────────────────
/** Returns an SVG QR code for the article's barcode (or article_number if no barcode). */
router.get('/:id/qrcode.svg', async (req, res, next) => {
  try {
    const db      = getDb();
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
    if (!article) return next(createError(404, 'Artikel nicht gefunden'));

    const content = article.barcode || article.article_number;
    const svg     = await QRCode.toString(content, { type: 'svg', width: 200, margin: 1 });

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `inline; filename="qr-${article.article_number}.svg"`);
    res.send(svg);
  } catch (err) { next(err); }
});

module.exports = router;
