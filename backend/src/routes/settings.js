const router = require('express').Router();
const { getDb }          = require('../db/init');
const { authenticate }   = require('../middleware/authenticate');
const { requireMinRole } = require('../middleware/requireRole');
const { createError }    = require('../middleware/errorHandler');
const { verifyTransport } = require('../services/mailer');

// ── Allowed settings keys & their defaults ────────────────────────────────────
const DEFAULTS = {
  notify_email: '',
};

function getAllSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const result = { ...DEFAULTS };
  for (const row of rows) result[row.key] = row.value;
  return result;
}

// ─── GET /api/settings  (warehouse_manager+) ──────────────────────────────────
router.get('/', authenticate, requireMinRole('warehouse_manager'), (req, res, next) => {
  try {
    const db       = getDb();
    const settings = getAllSettings(db);
    res.json({ settings });
  } catch (err) { next(err); }
});

// ─── PUT /api/settings/:key  (admin only) ─────────────────────────────────────
router.put('/:key', authenticate, requireMinRole('admin'), (req, res, next) => {
  try {
    const { key }   = req.params;
    const { value } = req.body;

    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
      return next(createError(400, `Unbekannter Einstellungsschlüssel: ${key}`));
    }
    if (value === undefined) return next(createError(400, 'Wert erforderlich'));

    const db = getDb();
    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, String(value));

    res.json({ key, value: String(value) });
  } catch (err) { next(err); }
});

// ─── GET /api/settings/smtp-test  (admin only) ────────────────────────────────
router.get('/smtp-test', authenticate, requireMinRole('admin'), async (req, res, next) => {
  try {
    const result = await verifyTransport();
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
