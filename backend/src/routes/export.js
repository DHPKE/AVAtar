const router = require('express').Router();
const { getDb }          = require('../db/init');
const { authenticate }   = require('../middleware/authenticate');
const { requireMinRole } = require('../middleware/requireRole');

router.use(authenticate, requireMinRole('warehouse_manager'));

function toCsv(headers, rows) {
  const escape = v => {
    if (v == null) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    headers.join(','),
    ...rows.map(row => headers.map(h => escape(row[h])).join(',')),
  ].join('\r\n');
}

// ─── GET /api/export/articles.csv ────────────────────────────────────────────
router.get('/articles.csv', (req, res, next) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT
        a.article_number, a.name, a.type, a.barcode,
        a.stock_qty, a.stock_meters, a.unit, a.min_stock,
        a.purchase_price,
        a.location_row, a.location_shelf, a.location_bin,
        c.name  AS category,
        g.name  AS "group",
        s.name  AS supplier,
        a.active, a.created_at
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN groups     g ON a.group_id    = g.id
      LEFT JOIN suppliers  s ON a.supplier_id = s.id
      ORDER BY a.article_number
    `).all();

    const headers = ['article_number','name','type','barcode','stock_qty','stock_meters','unit','min_stock','purchase_price','location_row','location_shelf','location_bin','category','group','supplier','active','created_at'];
    const csv     = toCsv(headers, rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="avatar-artikel-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send('\uFEFF' + csv); // BOM for Excel
  } catch (err) { next(err); }
});

// ─── GET /api/export/movements.csv ───────────────────────────────────────────
router.get('/movements.csv', (req, res, next) => {
  try {
    const db = getDb();
    const { from, to, article_id } = req.query;

    const conds  = [];
    const params = [];
    if (from)       { conds.push('m.created_at >= ?'); params.push(from); }
    if (to)         { conds.push('m.created_at <= ?'); params.push(to);   }
    if (article_id) { conds.push('m.article_id = ?');  params.push(Number(article_id)); }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const rows = db.prepare(`
      SELECT
        m.created_at, m.type, m.qty, m.meters, m.reference, m.group_ref,
        a.article_number, a.name AS article_name,
        u.username AS created_by
      FROM movements m
      JOIN articles a ON m.article_id = a.id
      JOIN users    u ON m.user_id    = u.id
      ${where}
      ORDER BY m.created_at DESC
    `).all(...params);

    const headers = ['created_at','type','qty','meters','reference','group_ref','article_number','article_name','created_by'];
    const csv     = toCsv(headers, rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="avatar-bewegungen-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (err) { next(err); }
});

module.exports = router;
