const router = require('express').Router();
const crypto = require('crypto');
const { getDb }           = require('../db/init');
const { authenticate }    = require('../middleware/authenticate');
const { requireMinRole }  = require('../middleware/requireRole');
const { createError }     = require('../middleware/errorHandler');

router.use(authenticate);

// ─── Constants ────────────────────────────────────────────────────────────────

// rental_out / rental_in are created exclusively by the rentals API
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

/** Fetch the Sammelartikel component list (component article rows + qty-per-unit) */
function getComponents(db, parentArticleId) {
  return db.prepare(`
    SELECT ac.qty AS qty_per_unit, a.*
    FROM article_components ac
    JOIN articles a ON a.id = ac.component_article_id
    WHERE ac.parent_article_id = ?
  `).all(parentArticleId);
}

/**
 * Applies one stock movement to a single article row (in the same way for
 * the Sammelartikel itself and for each of its components) and inserts the
 * corresponding movements row. Must be called inside a db.transaction().
 * Throws (with .status) on insufficient stock.
 */
function applyMovement(db, { article, type, amount, userId, reference, groupRef, label }) {
  const isCable = article.unit === 'meter';
  let newQty    = article.stock_qty;
  let newMeters = article.stock_meters;

  if (isCable) {
    if (type === 'in')           newMeters = article.stock_meters + amount;
    else if (type === 'out') {
      if (article.stock_meters < amount) {
        throw Object.assign(
          new Error(`${label ? label + ': ' : ''}nicht genug Bestand — verfügbar: ${article.stock_meters} m`),
          { status: 409 }
        );
      }
      newMeters = article.stock_meters - amount;
    } else newMeters = amount; // correction: absolute value
    db.prepare('UPDATE articles SET stock_meters = ? WHERE id = ?').run(newMeters, article.id);
  } else {
    if (type === 'in')           newQty = article.stock_qty + amount;
    else if (type === 'out') {
      if (article.stock_qty < amount) {
        throw Object.assign(
          new Error(`${label ? label + ': ' : ''}nicht genug Bestand — verfügbar: ${article.stock_qty} Stk`),
          { status: 409 }
        );
      }
      newQty = article.stock_qty - amount;
    } else newQty = amount; // correction: absolute value
    db.prepare('UPDATE articles SET stock_qty = ? WHERE id = ?').run(newQty, article.id);
  }

  const { lastInsertRowid } = db.prepare(`
    INSERT INTO movements (article_id, type, qty, meters, user_id, reference, group_ref)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    article.id,
    type,
    isCable ? 0      : amount,
    isCable ? amount : 0,
    userId,
    reference || null,
    groupRef  || null,
  );

  return { movementId: lastInsertRowid, qty: newQty, meters: newMeters };
}

/**
 * Books one line item: if the article is a Sammelartikel, this also books
 * the same `type` for every component (amount × Stückzahl pro Einheit),
 * all inside the SAME transaction the caller already holds — so either
 * everything books, or nothing does. Returns { main, components: [...] }.
 */
function bookArticleCascading(db, { article, type, amount, userId, reference }) {
  const groupRef = article.type === 'sammelartikel'
    ? `SET-${article.id}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
    : null;

  const main = applyMovement(db, {
    article, type, amount, userId, reference, groupRef,
    label: article.name,
  });

  const componentResults = [];
  if (article.type === 'sammelartikel') {
    const components = getComponents(db, article.id);
    for (const comp of components) {
      const compIsCable  = comp.unit === 'meter';
      const compAmount   = type === 'correction'
        ? amount * comp.qty_per_unit            // correction sets an absolute multiple, best-effort
        : amount * comp.qty_per_unit;
      const result = applyMovement(db, {
        article:   comp,
        type,
        amount:    compIsCable ? compAmount : Math.round(compAmount),
        userId,
        reference: reference ? `${reference} (Sammelartikel: ${article.name})` : `Sammelartikel: ${article.name}`,
        groupRef,
        label: comp.name,
      });
      componentResults.push({ article_id: comp.id, article_name: comp.name, ...result });
    }
  }

  return { main, components: componentResults, groupRef };
}

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

    if (article_id) { conds.push('m.article_id = ?'); params.push(Number(article_id)); }
    if (type)       { conds.push('m.type = ?');       params.push(type); }
    if (from)       { conds.push('m.created_at >= ?'); params.push(from); }
    if (to)         { conds.push('m.created_at <= ?'); params.push(to); }

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
    const article = db.prepare(
      'SELECT id, name, article_number, unit, stock_qty, stock_meters FROM articles WHERE id = ?'
    ).get(req.params.articleId);
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
 * Creates a movement and atomically updates article stock. If the article
 * is a Sammelartikel, this also books the same type for every component
 * (proportionally to the booked amount) in the same transaction.
 *
 * Body:
 *   article_id  {number}  required
 *   type        {string}  'in' | 'out' | 'correction'
 *   qty         {number}  for piece / bundle / sammelartikel articles
 *   meters      {number}  for cable articles
 *   reference   {string}  project/order number (optional)
 *
 * Returns: { movement, stock: { qty, meters }, components: [...] }
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

    // ── Atomic transaction (incl. Sammelartikel components) ───────────────────
    let bookingResult;

    const run = db.transaction(() => {
      bookingResult = bookArticleCascading(db, {
        article, type, amount,
        userId:    req.user.sub,
        reference: reference?.trim() || null,
      });
    });

    run();

    const movement = db.prepare(
      `${MOVEMENT_SELECT} WHERE m.id = ?`
    ).get(bookingResult.main.movementId);

    res.status(201).json({
      movement,
      stock:      { qty: bookingResult.main.qty, meters: bookingResult.main.meters },
      components: bookingResult.components,
    });
  } catch (err) { next(err); }
});

// ─── POST /api/movements/batch  — Warenkorb-Buchung ───────────────────────────
/**
 * Books an entire cart of pending bookings in a single atomic transaction.
 * Used by the "Artikel buchen" cart workflow: scan multiple articles,
 * queue them with quantities, then commit all at once. If any single item
 * fails (e.g. insufficient stock), the WHOLE batch rolls back — nothing is
 * partially booked — and the response identifies which item failed so the
 * frontend can highlight it for correction. Sammelartikel positions also
 * cascade their components within this same transaction.
 *
 * Body:
 *   items: [
 *     { article_id, type: 'in'|'out'|'correction', qty?, meters?, reference? },
 *     ...
 *   ]
 *
 * Returns: { booked: number, results: [{ movement_id, article_id, article_name, type, stock, components }] }
 */
router.post('/batch', (req, res, next) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return next(createError(400, 'Warenkorb ist leer'));
    }
    if (items.length > 200) {
      return next(createError(400, 'Maximal 200 Positionen pro Buchung'));
    }

    const db      = getDb();
    const results = [];

    const run = db.transaction(() => {
      items.forEach((item, index) => {
        const pos = index + 1; // human-readable position number
        const { article_id, type, qty = 0, meters = 0, reference } = item;

        if (!article_id || !type) {
          throw Object.assign(
            new Error(`Position ${pos}: article_id und type erforderlich`),
            { status: 400, failedIndex: index }
          );
        }
        if (!MANUAL_TYPES.includes(type)) {
          throw Object.assign(
            new Error(`Position ${pos}: ungültiger Typ`),
            { status: 400, failedIndex: index }
          );
        }

        const article = db.prepare(
          'SELECT * FROM articles WHERE id = ? AND active = 1'
        ).get(article_id);

        if (!article) {
          throw Object.assign(
            new Error(`Position ${pos}: Artikel nicht gefunden`),
            { status: 404, failedIndex: index }
          );
        }

        const isCable = article.unit === 'meter';
        const amount  = isCable ? parseFloat(meters) : parseInt(qty, 10);

        if (isNaN(amount) || amount < 0) {
          throw Object.assign(
            new Error(`Position ${pos} (${article.name}): ungültige Menge`),
            { status: 400, failedIndex: index, article_id: article.id }
          );
        }
        if (type !== 'correction' && amount === 0) {
          throw Object.assign(
            new Error(`Position ${pos} (${article.name}): Menge darf nicht 0 sein`),
            { status: 400, failedIndex: index, article_id: article.id }
          );
        }

        let bookingResult;
        try {
          bookingResult = bookArticleCascading(db, {
            article, type, amount,
            userId:    req.user.sub,
            reference: reference?.trim() || null,
          });
        } catch (innerErr) {
          // Re-throw with position context so the frontend can highlight this item
          throw Object.assign(
            new Error(`Position ${pos} (${article.name}): ${innerErr.message}`),
            { status: innerErr.status || 409, failedIndex: index, article_id: article.id }
          );
        }

        results.push({
          movement_id:  bookingResult.main.movementId,
          article_id:   article.id,
          article_name: article.name,
          type,
          stock:        { qty: bookingResult.main.qty, meters: bookingResult.main.meters },
          components:   bookingResult.components,
        });
      });
    });

    run();

    res.status(201).json({ booked: results.length, results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.applyMovement = applyMovement;
