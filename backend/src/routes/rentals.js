const router = require('express').Router();
const { getDb }           = require('../db/init');
const { authenticate }    = require('../middleware/authenticate');
const { requireMinRole }  = require('../middleware/requireRole');
const { createError }     = require('../middleware/errorHandler');

router.use(authenticate);

// ─── Base SELECT ──────────────────────────────────────────────────────────────

const RENTAL_SELECT = `
  SELECT
    r.*,
    a.name           AS article_name,
    a.article_number AS article_number,
    sn.serial_number AS serial_number,
    sn.status        AS serial_status,
    u1.username      AS rented_by_username,
    u2.username      AS created_by_username,
    CASE
      WHEN r.returned_at IS NULL
       AND r.expected_return IS NOT NULL
       AND r.expected_return < strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      THEN 1 ELSE 0
    END AS is_overdue
  FROM rentals r
  JOIN articles      a  ON r.article_id        = a.id
  JOIN serial_numbers sn ON r.serial_number_id = sn.id
  JOIN users         u1 ON r.rented_by_user_id = u1.id
  JOIN users         u2 ON r.created_by        = u2.id
`;

// ─── GET /api/rentals ─────────────────────────────────────────────────────────
/**
 * Query params:
 *   active     '1' = not yet returned (default), '0' = returned, 'all'
 *   overdue    '1' = only overdue
 *   article_id filter by article
 *   limit, offset
 */
router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const {
      active = '1', overdue,
      article_id,
      limit = '50', offset = '0',
    } = req.query;

    const conds  = [];
    const params = [];

    if (active !== 'all') {
      if (active === '1') {
        conds.push('r.returned_at IS NULL');
      } else {
        conds.push('r.returned_at IS NOT NULL');
      }
    }
    if (overdue === '1') {
      conds.push(`r.returned_at IS NULL
        AND r.expected_return IS NOT NULL
        AND r.expected_return < strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`);
    }
    if (article_id) {
      conds.push('r.article_id = ?');
      params.push(Number(article_id));
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const lim   = Math.min(Number(limit) || 50, 200);
    const off   = Number(offset) || 0;

    const rentals = db.prepare(
      `${RENTAL_SELECT} ${where} ORDER BY r.rented_at DESC LIMIT ? OFFSET ?`
    ).all(...params, lim, off);

    const { total } = db.prepare(
      `SELECT COUNT(*) AS total FROM rentals r ${where}`
    ).get(...params);

    res.json({ rentals, total, limit: lim, offset: off });
  } catch (err) { next(err); }
});

// ─── GET /api/rentals/overdue ─────────────────────────────────────────────────
// Must be defined BEFORE /:id to avoid route conflict
router.get('/overdue', (req, res, next) => {
  try {
    const db      = getDb();
    const rentals = db.prepare(`
      ${RENTAL_SELECT}
      WHERE r.returned_at IS NULL
        AND r.expected_return IS NOT NULL
        AND r.expected_return < strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      ORDER BY r.expected_return ASC
    `).all();

    res.json({ rentals, total: rentals.length });
  } catch (err) { next(err); }
});

// ─── GET /api/rentals/:id ─────────────────────────────────────────────────────
router.get('/:id', (req, res, next) => {
  try {
    const db     = getDb();
    const rental = db.prepare(`${RENTAL_SELECT} WHERE r.id = ?`).get(req.params.id);
    if (!rental) return next(createError(404, 'Verleih nicht gefunden'));
    res.json({ rental });
  } catch (err) { next(err); }
});

// ─── POST /api/rentals  — Checkout ───────────────────────────────────────────
/**
 * Checks out a serialised article to a person/company.
 *
 * Body:
 *   serial_number_id  {number}  required
 *   rented_to         {string}  required — name / company (free text)
 *   expected_return   {string}  ISO date (optional)
 *   notes             {string}  optional
 *
 * Transaction:
 *   1. Verify serial number is 'available'
 *   2. Set serial_numbers.status → 'rented'
 *   3. Insert rentals row
 *   4. Insert movements row (type = 'rental_out', qty = 1)
 */
router.post('/', requireMinRole('warehouse_manager'), (req, res, next) => {
  try {
    const {
      serial_number_id,
      rented_to,
      expected_return,
      notes,
    } = req.body;

    if (!serial_number_id) return next(createError(400, 'serial_number_id erforderlich'));
    if (!rented_to?.trim()) return next(createError(400, 'rented_to erforderlich'));

    const db = getDb();
    const sn = db.prepare(
      'SELECT sn.*, a.type AS article_type FROM serial_numbers sn JOIN articles a ON sn.article_id = a.id WHERE sn.id = ?'
    ).get(serial_number_id);

    if (!sn) return next(createError(404, 'Seriennummer nicht gefunden'));

    if (!['equipment', 'rental'].includes(sn.article_type)) {
      return next(createError(400, 'Verleih nur für Gerät- und Verleih-Artikel'));
    }
    if (sn.status !== 'available') {
      return next(createError(409,
        `Gerät nicht verfügbar — aktueller Status: ${sn.status}`
      ));
    }

    let rentalId;

    db.transaction(() => {
      // 1. Mark serial number as rented
      db.prepare(`UPDATE serial_numbers SET status = 'rented' WHERE id = ?`).run(sn.id);

      // 2. Create rental record
      const { lastInsertRowid } = db.prepare(`
        INSERT INTO rentals
          (serial_number_id, article_id, rented_by_user_id, rented_to,
           expected_return, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        sn.id,
        sn.article_id,
        req.user.sub,
        rented_to.trim(),
        expected_return || null,
        notes?.trim()   || null,
        req.user.sub,
      );
      rentalId = lastInsertRowid;

      // 3. Record movement
      db.prepare(`
        INSERT INTO movements
          (article_id, serial_number_id, type, qty, meters, user_id, reference)
        VALUES (?, ?, 'rental_out', 1, 0, ?, ?)
      `).run(sn.article_id, sn.id, req.user.sub, `Verleih #${rentalId}`);
    })();

    const rental = db.prepare(`${RENTAL_SELECT} WHERE r.id = ?`).get(rentalId);
    res.status(201).json({ rental });
  } catch (err) { next(err); }
});

// ─── POST /api/rentals/:id/return  — Rückgabe ─────────────────────────────────
/**
 * Returns a rented item.
 *
 * Body:
 *   notes  {string}  optional return notes
 *
 * Transaction:
 *   1. Verify rental exists and has not been returned
 *   2. Set serial_numbers.status → 'available'
 *   3. Set rentals.returned_at = NOW
 *   4. Insert movements row (type = 'rental_in', qty = 1)
 */
router.post('/:id/return', requireMinRole('warehouse_manager'), (req, res, next) => {
  try {
    const db     = getDb();
    const rental = db.prepare('SELECT * FROM rentals WHERE id = ?').get(req.params.id);

    if (!rental) return next(createError(404, 'Verleih nicht gefunden'));
    if (rental.returned_at) {
      return next(createError(409, 'Artikel wurde bereits zurückgegeben'));
    }

    const { notes } = req.body;
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

    db.transaction(() => {
      // 1. Mark serial number as available again
      db.prepare(`UPDATE serial_numbers SET status = 'available' WHERE id = ?`)
        .run(rental.serial_number_id);

      // 2. Close the rental
      db.prepare(`
        UPDATE rentals SET returned_at = ?, notes = COALESCE(?, notes) WHERE id = ?
      `).run(now, notes?.trim() || null, rental.id);

      // 3. Record movement
      db.prepare(`
        INSERT INTO movements
          (article_id, serial_number_id, type, qty, meters, user_id, reference)
        VALUES (?, ?, 'rental_in', 1, 0, ?, ?)
      `).run(rental.article_id, rental.serial_number_id, req.user.sub, `Rückgabe #${rental.id}`);
    })();

    const updated = db.prepare(`${RENTAL_SELECT} WHERE r.id = ?`).get(rental.id);
    res.json({ rental: updated });
  } catch (err) { next(err); }
});

module.exports = router;
