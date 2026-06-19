const router = require('express').Router();
const { getDb }           = require('../db/init');
const { authenticate }    = require('../middleware/authenticate');
const { requireMinRole }  = require('../middleware/requireRole');
const { createError }     = require('../middleware/errorHandler');

router.use(authenticate);

// ─── GET /api/groups ───────────────────────────────────────────────────────────
router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const groups = db.prepare(
      'SELECT * FROM groups ORDER BY name'
    ).all();
    res.json({ groups });
  } catch (err) { next(err); }
});

// ─── POST /api/groups ──────────────────────────────────────────────────────────
router.post('/', requireMinRole('warehouse_manager'), (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return next(createError(400, 'Name erforderlich'));

    const db     = getDb();
    const result = db.prepare(
      'INSERT INTO groups (name, description) VALUES (?, ?)'
    ).run(name.trim(), description?.trim() || null);

    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ group });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      return next(createError(409, 'Gruppe bereits vorhanden'));
    }
    next(err);
  }
});

// ─── PUT /api/groups/:id ────────────────────────────────────────────────────────
router.put('/:id', requireMinRole('warehouse_manager'), (req, res, next) => {
  try {
    const db    = getDb();
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
    if (!group) return next(createError(404, 'Gruppe nicht gefunden'));

    const { name, description } = req.body;
    db.prepare('UPDATE groups SET name = ?, description = ? WHERE id = ?').run(
      name?.trim()        ?? group.name,
      description?.trim() ?? group.description,
      group.id,
    );

    const updated = db.prepare('SELECT * FROM groups WHERE id = ?').get(group.id);
    res.json({ group: updated });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      return next(createError(409, 'Gruppenname bereits vergeben'));
    }
    next(err);
  }
});

// ─── DELETE /api/groups/:id ─────────────────────────────────────────────────────
router.delete('/:id', requireMinRole('admin'), (req, res, next) => {
  try {
    const db    = getDb();
    const group = db.prepare('SELECT id FROM groups WHERE id = ?').get(req.params.id);
    if (!group) return next(createError(404, 'Gruppe nicht gefunden'));

    const { count } = db.prepare(
      'SELECT COUNT(*) AS count FROM articles WHERE group_id = ?'
    ).get(group.id);

    if (count > 0) {
      return next(createError(409, `Gruppe wird noch von ${count} Artikel(n) verwendet`));
    }

    db.prepare('DELETE FROM groups WHERE id = ?').run(group.id);
    res.json({ message: 'Gruppe gelöscht' });
  } catch (err) { next(err); }
});

module.exports = router;
