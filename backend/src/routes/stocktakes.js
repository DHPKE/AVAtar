const router = require('express').Router();
const { getDb }            = require('../db/init');
const { authenticate }     = require('../middleware/authenticate');
const { requireMinRole }   = require('../middleware/requireRole');
const { createError }      = require('../middleware/errorHandler');
const { applyMovement }    = require('./movements');

router.use(authenticate);

/** Joins article + category/group names onto a stocktake_items row */
const ITEM_SELECT = `
  SELECT
    si.*,
    a.name AS article_name, a.article_number, a.unit, a.barcode,
    a.location_row, a.location_shelf, a.location_bin,
    c.name AS category_name, g.name AS group_name
  FROM stocktake_items si
  JOIN articles a        ON a.id = si.article_id
  LEFT JOIN categories c ON a.category_id = c.id
  LEFT JOIN groups     g ON a.group_id    = g.id
`;

const DIFF_COND = `
  si.counted_at IS NOT NULL AND (
    (a.unit = 'meter' AND si.ist_meters != si.soll_meters) OR
    (a.unit != 'meter' AND si.ist_qty    != si.soll_qty)
  )
`;

// ─── GET /api/stocktakes ───────────────────────────────────────────────────────
router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const stocktakes = db.prepare(`
      SELECT s.*, u.username AS created_by_username,
        (SELECT COUNT(*) FROM stocktake_items WHERE stocktake_id = s.id) AS item_count,
        (SELECT COUNT(*) FROM stocktake_items WHERE stocktake_id = s.id AND counted_at IS NOT NULL) AS counted_count
      FROM stocktakes s
      JOIN users u ON u.id = s.created_by
      ORDER BY s.created_at DESC
    `).all();
    res.json({ stocktakes });
  } catch (err) { next(err); }
});

// ─── POST /api/stocktakes  (warehouse_manager+) ───────────────────────────────
/** Erstellt eine Inventur + Soll-Snapshot aller (gefilterten) aktiven Artikel. */
router.post('/', requireMinRole('warehouse_manager'), (req, res, next) => {
  try {
    const { name, type, category_id, group_id } = req.body;
    if (!name?.trim()) return next(createError(400, 'Name erforderlich'));

    const db     = getDb();
    const conds  = ['active = 1'];
    const params = [];
    if (type)        { conds.push('type = ?');        params.push(type); }
    if (category_id) { conds.push('category_id = ?'); params.push(Number(category_id)); }
    if (group_id)     { conds.push('group_id = ?');   params.push(Number(group_id)); }

    const articles = db.prepare(
      `SELECT id, stock_qty, stock_meters FROM articles WHERE ${conds.join(' AND ')}`
    ).all(...params);

    if (!articles.length) return next(createError(400, 'Keine Artikel für diese Filter gefunden'));

    let stocktakeId;
    const run = db.transaction(() => {
      ({ lastInsertRowid: stocktakeId } = db.prepare(
        'INSERT INTO stocktakes (name, created_by) VALUES (?, ?)'
      ).run(name.trim(), req.user.sub));

      const insertItem = db.prepare(`
        INSERT INTO stocktake_items (stocktake_id, article_id, soll_qty, soll_meters)
        VALUES (?, ?, ?, ?)
      `);
      for (const a of articles) insertItem.run(stocktakeId, a.id, a.stock_qty, a.stock_meters);
    });
    run();

    const stocktake = db.prepare('SELECT * FROM stocktakes WHERE id = ?').get(stocktakeId);
    res.status(201).json({ stocktake, itemCount: articles.length });
  } catch (err) { next(err); }
});

// ─── GET /api/stocktakes/:id ───────────────────────────────────────────────────
router.get('/:id', (req, res, next) => {
  try {
    const db        = getDb();
    const stocktake = db.prepare('SELECT * FROM stocktakes WHERE id = ?').get(req.params.id);
    if (!stocktake) return next(createError(404, 'Inventur nicht gefunden'));
    res.json({ stocktake });
  } catch (err) { next(err); }
});

// ─── GET /api/stocktakes/:id/items ─────────────────────────────────────────────
/** Query: category_id, group_id, search, only_open=1, only_diff=1 */
router.get('/:id/items', (req, res, next) => {
  try {
    const db        = getDb();
    const stocktake = db.prepare('SELECT * FROM stocktakes WHERE id = ?').get(req.params.id);
    if (!stocktake) return next(createError(404, 'Inventur nicht gefunden'));

    const { category_id, group_id, search, only_open, only_diff } = req.query;
    const conds  = ['si.stocktake_id = ?'];
    const params = [stocktake.id];

    if (category_id) { conds.push('a.category_id = ?'); params.push(Number(category_id)); }
    if (group_id)     { conds.push('a.group_id = ?');   params.push(Number(group_id)); }
    if (search?.trim()) {
      conds.push('(a.name LIKE ? OR a.article_number LIKE ? OR a.barcode LIKE ?)');
      const t = `%${search.trim()}%`;
      params.push(t, t, t);
    }
    if (only_open === '1') conds.push('si.counted_at IS NULL');
    if (only_diff === '1') conds.push(DIFF_COND);

    const items = db.prepare(
      `${ITEM_SELECT} WHERE ${conds.join(' AND ')} ORDER BY a.name`
    ).all(...params);

    res.json({ stocktake, items });
  } catch (err) { next(err); }
});

// ─── GET /api/stocktakes/:id/diff  ← Fehlmaterialliste ────────────────────────
router.get('/:id/diff', (req, res, next) => {
  try {
    const db        = getDb();
    const stocktake = db.prepare('SELECT * FROM stocktakes WHERE id = ?').get(req.params.id);
    if (!stocktake) return next(createError(404, 'Inventur nicht gefunden'));

    const items = db.prepare(
      `${ITEM_SELECT} WHERE si.stocktake_id = ? AND ${DIFF_COND} ORDER BY a.name`
    ).all(stocktake.id);

    const diff = items.map(i => ({
      ...i,
      delta: i.unit === 'meter' ? (i.ist_meters - i.soll_meters) : (i.ist_qty - i.soll_qty),
    }));

    res.json({ stocktake, diff });
  } catch (err) { next(err); }
});

// ─── PUT /api/stocktakes/:id/items/:articleId  ← Ist-Bestand eintragen ───────
router.put('/:id/items/:articleId', (req, res, next) => {
  try {
    const db        = getDb();
    const stocktake = db.prepare('SELECT * FROM stocktakes WHERE id = ?').get(req.params.id);
    if (!stocktake) return next(createError(404, 'Inventur nicht gefunden'));
    if (stocktake.status === 'closed') return next(createError(409, 'Inventur bereits abgeschlossen'));

    const item = db.prepare(
      'SELECT * FROM stocktake_items WHERE stocktake_id = ? AND article_id = ?'
    ).get(stocktake.id, req.params.articleId);
    if (!item) return next(createError(404, 'Position nicht gefunden'));

    const { qty, meters } = req.body;
    const istQty    = qty    !== undefined ? parseInt(qty, 10)  : 0;
    const istMeters = meters !== undefined ? parseFloat(meters) : 0;
    if (isNaN(istQty)    || istQty < 0)    return next(createError(400, 'Menge muss eine positive Zahl sein'));
    if (isNaN(istMeters) || istMeters < 0) return next(createError(400, 'Menge muss eine positive Zahl sein'));

    db.prepare(`
      UPDATE stocktake_items SET
        ist_qty = ?, ist_meters = ?,
        counted_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), counted_by = ?
      WHERE id = ?
    `).run(istQty, istMeters, req.user.sub, item.id);

    const updated = db.prepare(`${ITEM_SELECT} WHERE si.id = ?`).get(item.id);
    res.json({ item: updated });
  } catch (err) { next(err); }
});

// ─── POST /api/stocktakes/:id/close  (warehouse_manager+) ────────────────────
/** Schreibt für jede gezählte Abweichung eine 'correction'-Buchung & schließt die Inventur. */
router.post('/:id/close', requireMinRole('warehouse_manager'), (req, res, next) => {
  try {
    const db        = getDb();
    const stocktake = db.prepare('SELECT * FROM stocktakes WHERE id = ?').get(req.params.id);
    if (!stocktake) return next(createError(404, 'Inventur nicht gefunden'));
    if (stocktake.status === 'closed') return next(createError(409, 'Inventur bereits abgeschlossen'));

    const items = db.prepare(`
      SELECT si.*, a.unit, a.stock_qty, a.stock_meters
      FROM stocktake_items si
      JOIN articles a ON a.id = si.article_id
      WHERE si.stocktake_id = ? AND si.counted_at IS NOT NULL
    `).all(stocktake.id);

    let corrected = 0;
    const run = db.transaction(() => {
      for (const item of items) {
        const isCable = item.unit === 'meter';
        const sollVal = isCable ? item.soll_meters : item.soll_qty;
        const istVal  = isCable ? item.ist_meters  : item.ist_qty;
        if (istVal === sollVal) continue;

        applyMovement(db, {
          article: {
            id: item.article_id, unit: item.unit,
            stock_qty: item.stock_qty, stock_meters: item.stock_meters,
          },
          type:      'correction',
          amount:    istVal,
          userId:    req.user.sub,
          reference: `Inventur #${stocktake.id}: ${stocktake.name}`,
        });
        corrected++;
      }

      db.prepare(`
        UPDATE stocktakes SET status = 'closed',
          closed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), closed_by = ?
        WHERE id = ?
      `).run(req.user.sub, stocktake.id);
    });
    run();

    res.json({ message: 'Inventur abgeschlossen', corrected });
  } catch (err) { next(err); }
});

// ─── DELETE /api/stocktakes/:id  (warehouse_manager+) ─────────────────────────
router.delete('/:id', requireMinRole('warehouse_manager'), (req, res, next) => {
  try {
    const db        = getDb();
    const stocktake = db.prepare('SELECT * FROM stocktakes WHERE id = ?').get(req.params.id);
    if (!stocktake) return next(createError(404, 'Inventur nicht gefunden'));
    if (stocktake.status === 'closed') return next(createError(409, 'Abgeschlossene Inventuren können nicht gelöscht werden'));

    db.prepare('DELETE FROM stocktakes WHERE id = ?').run(stocktake.id);
    res.json({ message: 'Inventur gelöscht' });
  } catch (err) { next(err); }
});

module.exports = router;
