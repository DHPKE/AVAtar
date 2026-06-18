const router = require('express').Router();
const { getDb }           = require('../db/init');
const { authenticate }    = require('../middleware/authenticate');
const { requireMinRole }  = require('../middleware/requireRole');
const { createError }     = require('../middleware/errorHandler');

router.use(authenticate);

// ─── GET /api/suppliers ───────────────────────────────────────────────────────
router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const suppliers = db.prepare('SELECT * FROM suppliers ORDER BY name').all();
    res.json({ suppliers });
  } catch (err) { next(err); }
});

// ─── GET /api/suppliers/:id ───────────────────────────────────────────────────
router.get('/:id', (req, res, next) => {
  try {
    const db       = getDb();
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!supplier) return next(createError(404, 'Lieferant nicht gefunden'));
    res.json({ supplier });
  } catch (err) { next(err); }
});

// ─── POST /api/suppliers ──────────────────────────────────────────────────────
router.post('/', requireMinRole('warehouse_manager'), (req, res, next) => {
  try {
    const { name, contact_person, email, phone, notes } = req.body;
    if (!name?.trim()) return next(createError(400, 'Name erforderlich'));

    const db     = getDb();
    const result = db.prepare(`
      INSERT INTO suppliers (name, contact_person, email, phone, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      contact_person?.trim() || null,
      email?.trim()          || null,
      phone?.trim()          || null,
      notes?.trim()          || null,
    );

    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ supplier });
  } catch (err) { next(err); }
});

// ─── PUT /api/suppliers/:id ───────────────────────────────────────────────────
router.put('/:id', requireMinRole('warehouse_manager'), (req, res, next) => {
  try {
    const db       = getDb();
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!supplier) return next(createError(404, 'Lieferant nicht gefunden'));

    const { name, contact_person, email, phone, notes } = req.body;
    db.prepare(`
      UPDATE suppliers SET name = ?, contact_person = ?, email = ?, phone = ?, notes = ?
      WHERE id = ?
    `).run(
      name?.trim()           ?? supplier.name,
      contact_person?.trim() ?? supplier.contact_person,
      email?.trim()          ?? supplier.email,
      phone?.trim()          ?? supplier.phone,
      notes?.trim()          ?? supplier.notes,
      supplier.id,
    );

    const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplier.id);
    res.json({ supplier: updated });
  } catch (err) { next(err); }
});

// ─── DELETE /api/suppliers/:id ────────────────────────────────────────────────
router.delete('/:id', requireMinRole('admin'), (req, res, next) => {
  try {
    const db       = getDb();
    const supplier = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(req.params.id);
    if (!supplier) return next(createError(404, 'Lieferant nicht gefunden'));

    const { count } = db.prepare(
      'SELECT COUNT(*) AS count FROM articles WHERE supplier_id = ?'
    ).get(supplier.id);

    if (count > 0) {
      return next(createError(409, `Lieferant wird noch von ${count} Artikel(n) verwendet`));
    }

    db.prepare('DELETE FROM suppliers WHERE id = ?').run(supplier.id);
    res.json({ message: 'Lieferant gelöscht' });
  } catch (err) { next(err); }
});

module.exports = router;
