const router = require('express').Router();
const { getDb }           = require('../db/init');
const { authenticate }    = require('../middleware/authenticate');
const { requireMinRole }  = require('../middleware/requireRole');
const { createError }     = require('../middleware/errorHandler');

router.use(authenticate);

// ─── GET /api/categories ──────────────────────────────────────────────────────
router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const categories = db.prepare(
      'SELECT * FROM categories ORDER BY name'
    ).all();
    res.json({ categories });
  } catch (err) { next(err); }
});

// ─── POST /api/categories ─────────────────────────────────────────────────────
router.post('/', requireMinRole('warehouse_manager'), (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return next(createError(400, 'Name erforderlich'));

    const db     = getDb();
    const result = db.prepare(
      'INSERT INTO categories (name, description) VALUES (?, ?)'
    ).run(name.trim(), description?.trim() || null);

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ category });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      return next(createError(409, 'Kategorie bereits vorhanden'));
    }
    next(err);
  }
});

// ─── PUT /api/categories/:id ──────────────────────────────────────────────────
router.put('/:id', requireMinRole('warehouse_manager'), (req, res, next) => {
  try {
    const db  = getDb();
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!cat) return next(createError(404, 'Kategorie nicht gefunden'));

    const { name, description } = req.body;
    db.prepare('UPDATE categories SET name = ?, description = ? WHERE id = ?').run(
      name?.trim()        ?? cat.name,
      description?.trim() ?? cat.description,
      cat.id,
    );

    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(cat.id);
    res.json({ category: updated });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      return next(createError(409, 'Kategoriename bereits vergeben'));
    }
    next(err);
  }
});

// ─── DELETE /api/categories/:id ───────────────────────────────────────────────
router.delete('/:id', requireMinRole('admin'), (req, res, next) => {
  try {
    const db  = getDb();
    const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(req.params.id);
    if (!cat) return next(createError(404, 'Kategorie nicht gefunden'));

    const { count } = db.prepare(
      'SELECT COUNT(*) AS count FROM articles WHERE category_id = ?'
    ).get(cat.id);

    if (count > 0) {
      return next(createError(409, `Kategorie wird noch von ${count} Artikel(n) verwendet`));
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(cat.id);
    res.json({ message: 'Kategorie gelöscht' });
  } catch (err) { next(err); }
});

module.exports = router;
