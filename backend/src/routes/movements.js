const router = require('express').Router();
const { getDb }           = require('../db/init');
const { authenticate }    = require('../middleware/authenticate');
const { requireMinRole }  = require('../middleware/requireRole');
const { createError }     = require('../middleware/errorHandler');

router.use(authenticate);

// ─── Constants ────────────────────────────────────────────────────────────────

// rental_out / rental_in are created exclusively by the rentals API (Phase 5)
const MANUAL_TYPES = ['in', 'out', 'correction'];

/** Full movement SELECT — joins article + user for rich responses */
const MOVEMENT_SELECT = `
  SELECT
    m.*,
    a.name           AS article_name,
    a.article_number AS article_number,
    a.unit           AS article_unit,
    u.username       AS created_by_username
  FROM movements m
  JOIN articles a ON m.article_id  = a.id
  JOIN users    u ON m.user_id     = u.id
`;

// ─── GET /api/movements ───────────────────────────────────────────────────────
/**
 * Query params:
 *   article_id, type, from (ISO date), to (ISO date),
 *   limit (default 50, max 200), offset (default 0)
 */
router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const {
      article_id, type,
      from, to,
      limit = '50', offset = '0',
    } = req.query;

    const conds  = [];
    const params = [];

    if (article_id) {
      conds.push('m.article_id = ?');
      params.push(Number(article_id));
    }
    if (type) {
      conds.push('m.type = ?');
      params.push(type);
    }
    if (from) {
      conds.push('m.created_at >= ?');
      params.push(from);
    }
    if (to) {
      conds.push('m.created_at <= ?');
      params.push(to);
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const lim   = Math.min(Number(limit) || 50, 200);
    const off   = Number(offset) || 0;

    const movements = db.prepare(
      `${MOVEMENT_SELECT} ${where} ORDER BY m.created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, lim, off);

    const { total } = db.prepare(
      `SELECT COUNT(*) AS total FROM movements m ${where}`
    ).get(...params);

    res.json({ movements, total, limit: lim, offset: off });
  } catch (err) { next(err); }
});

// ─── GET /api/movements/article/:articleId ────────────────────────────────────
/** Full movement history for one article, newest first */
router.get('/article/:articleId', (req, res, next) => {
  try {
    const db      = getDb();
    const article = db.prepare('SELECT id, name, article_number, unit, stock_qty, stock_meters FROM articles WHERE id = ?').get(req.params.articleId);
    if (!article) return next(createError(404, 'Artikel nicht gefunden'));

    const { limit = '100', offset = '0' } = req.query;
    const lim = Math.min(Number(limit) || 100, 500);
    const off = Number(offset) || 0;

    const movements = db.prepare(
      `${MOVEMENT_SELECT} WHERE m.article_id = ? ORDER BY m.created_at DESC LIMIT ? OFFSET ?`
    ).all(article.id, lim, off);

    const { total } = db.prepare(
      'SELECT COUNT(*) AS total FROM movements WHERE article_id = ?'
    ).get(article.id);

    res.json({ article, movements, total, limit: lim, offset: off });
  } catch (err) { next(err); }
});

// ─── POST /api/movements ──────────────────────────────────────────────────────
/**
 * Creates a movement and atomically updates article stock.
 *
 * Body:
 *   article_id  {number}  required
 *   type        {string}  'in' | 'out' | 'correction'
 *   qty         {number}  for piece / bundle articles
 *   meters      {number}  for cable articles
 *   reference   {string}  project/order number (optional)
 *
 * Returns: { movement, stock: { qty, meters } }
 */
router.post('/', (req, res, next) => {
  try {
    const {
      article_id,
      type,
      qty     = 0,
      meters  = 0,
      reference,
    } = req.body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!article_id) return next(createError(400, 'article_id erforderlich'));
    if (!type)       return next(createError(400, 'Typ erforderlich'));

    if (!MANUAL_TYPES.includes(type)) {
      return next(createError(400,
        `Ungültiger Typ. Manuelle Buchungen: ${MANUAL_TYPES.join(', ')}`
      ));
    }

    const db      = getDb();
    const article = db.prepare(
      'SELECT * FROM articles WHERE id = ? AND active = 1'
    ).get(article_id);

    if (!article) return next(createError(404, 'Artikel nicht gefunden'));

    const isCable = article.unit === 'meter';
    const amount  = isCable ? parseFloat(meters) : parseInt(qty, 10);

    if (isNaN(amount) || amount < 0) {
      return next(createError(400, 'Menge muss eine positive Zahl sein'));
    }
    if (type !== 'correction' && amount === 0) {
      return next(createError(400, 'Menge darf nicht 0 sein'));
    }

    // ── Atomic transaction ────────────────────────────────────────────────────
    let movementId;
    let newQty    = article.stock_qty;
    let newMeters = article.stock_meters;

    const run = db.transaction(() => {
      if (isCable) {
        if (type === 'in') {
          newMeters = article.stock_meters + amount;
        } else if (type === 'out') {
          if (article.stock_meters < amount) {
            throw Object.assign(
              new Error(`Nicht genug Bestand — verfügbar: ${article.stock_meters} m`),
              { status: 409 }
            );
          }
          newMeters = article.stock_meters - amount;
        } else {
          // correction: set absolute value
          newMeters = amount;
        }
        db.prepare('UPDATE articles SET stock_meters = ? WHERE id = ?')
          .run(newMeters, article.id);
      } else {
        if (type === 'in') {
          newQty = article.stock_qty + amount;
        } else if (type === 'out') {
          if (article.stock_qty < amount) {
            throw Object.assign(
              new Error(`Nicht genug Bestand — verfügbar: ${article.stock_qty} Stk`),
              { status: 409 }
            );
          }
          newQty = article.stock_qty - amount;
        } else {
          // correction: set absolute value
          newQty = amount;
        }
        db.prepare('UPDATE articles SET stock_qty = ? WHERE id = ?')
          .run(newQty, article.id);
      }

      // Record the movement
      const { lastInsertRowid } = db.prepare(`
        INSERT INTO movements
          (article_id, type, qty, meters, user_id, reference)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        article.id,
        type,
        isCable ? 0       : amount,
        isCable ? amount  : 0,
        req.user.sub,
        reference?.trim() || null,
      );

      movementId = lastInsertRowid;
    });

    run();

    const movement = db.prepare(
      `${MOVEMENT_SELECT} WHERE m.id = ?`
    ).get(movementId);

    res.status(201).json({
      movement,
      stock: { qty: newQty, meters: newMeters },
    });
  } catch (err) { next(err); }
});

module.exports = router;
