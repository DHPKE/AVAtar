const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { getDb }          = require('../db/init');
const { authenticate }   = require('../middleware/authenticate');
const { requireMinRole } = require('../middleware/requireRole');
const { createError }    = require('../middleware/errorHandler');

router.use(authenticate, requireMinRole('admin'));

function sanitise(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

/** Normalises and validates a shortcode: 2-6 chars, letters/digits only */
function normaliseShortcode(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const code = String(raw).trim().toUpperCase();
  if (!/^[A-Z0-9]{2,6}$/.test(code)) {
    throw Object.assign(new Error('Kürzel muss 2-6 Buchstaben/Zahlen sein'), { status: 400 });
  }
  return code;
}

// ─── GET /api/users ───────────────────────────────────────────────────────────
router.get('/', (req, res, next) => {
  try {
    const db    = getDb();
    const users = db.prepare(
      'SELECT * FROM users ORDER BY username'
    ).all().map(sanitise);
    res.json({ users, total: users.length });
  } catch (err) { next(err); }
});

// ─── POST /api/users ──────────────────────────────────────────────────────────
router.post('/', (req, res, next) => {
  try {
    const { username, email, password, role = 'staff', shortcode } = req.body;

    if (!username?.trim()) return next(createError(400, 'Benutzername erforderlich'));
    if (!email?.trim())    return next(createError(400, 'E-Mail erforderlich'));
    if (!password)         return next(createError(400, 'Passwort erforderlich'));
    if (password.length < 8) return next(createError(400, 'Passwort mindestens 8 Zeichen'));

    const VALID_ROLES = ['staff', 'warehouse_manager', 'admin'];
    if (!VALID_ROLES.includes(role)) {
      return next(createError(400, `Ungültige Rolle. Erlaubt: ${VALID_ROLES.join(', ')}`));
    }

    const code = normaliseShortcode(shortcode);

    const db   = getDb();
    const hash = bcrypt.hashSync(password, 12);

    const { lastInsertRowid } = db.prepare(`
      INSERT INTO users (username, email, password_hash, role, shortcode)
      VALUES (?, ?, ?, ?, ?)
    `).run(username.trim(), email.trim(), hash, role, code);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
    res.status(201).json({ user: sanitise(user) });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint failed: users.username')) {
      return next(createError(409, 'Benutzername bereits vergeben'));
    }
    if (err.message?.includes('UNIQUE constraint failed: users.email')) {
      return next(createError(409, 'E-Mail bereits vergeben'));
    }
    if (err.message?.includes('UNIQUE constraint failed') && err.message?.includes('shortcode')) {
      return next(createError(409, 'Kürzel bereits vergeben'));
    }
    next(err);
  }
});

// ─── PUT /api/users/:id ───────────────────────────────────────────────────────
router.put('/:id', (req, res, next) => {
  try {
    const db   = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return next(createError(404, 'Benutzer nicht gefunden'));

    const { email, role, active, shortcode } = req.body;
    const VALID_ROLES = ['staff', 'warehouse_manager', 'admin'];
    if (role && !VALID_ROLES.includes(role)) {
      return next(createError(400, `Ungültige Rolle. Erlaubt: ${VALID_ROLES.join(', ')}`));
    }

    // Admin cannot deactivate themselves
    if (req.user.sub === user.id && active === false) {
      return next(createError(400, 'Eigenen Account nicht deaktivierbar'));
    }

    const code = shortcode !== undefined ? normaliseShortcode(shortcode) : user.shortcode;

    db.prepare(`
      UPDATE users SET email = ?, role = ?, active = ?, shortcode = ? WHERE id = ?
    `).run(
      email  ?? user.email,
      role   ?? user.role,
      active !== undefined ? (active ? 1 : 0) : user.active,
      code,
      user.id,
    );

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    res.json({ user: sanitise(updated) });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint failed: users.email')) {
      return next(createError(409, 'E-Mail bereits vergeben'));
    }
    if (err.message?.includes('UNIQUE constraint failed') && err.message?.includes('shortcode')) {
      return next(createError(409, 'Kürzel bereits vergeben'));
    }
    next(err);
  }
});

// ─── POST /api/users/:id/reset-password ───────────────────────────────────────
router.post('/:id/reset-password', (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return next(createError(400, 'Passwort mindestens 8 Zeichen'));
    }

    const db   = getDb();
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!user) return next(createError(404, 'Benutzer nicht gefunden'));

    const hash = bcrypt.hashSync(newPassword, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);

    res.json({ message: 'Passwort zurückgesetzt' });
  } catch (err) { next(err); }
});

// ─── DELETE /api/users/:id → soft-delete (deactivate) ────────────────────────
router.delete('/:id', (req, res, next) => {
  try {
    const db   = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return next(createError(404, 'Benutzer nicht gefunden'));

    if (req.user.sub === user.id) {
      return next(createError(400, 'Eigenen Account nicht löschbar'));
    }

    db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(user.id);
    res.json({ message: 'Benutzer deaktiviert' });
  } catch (err) { next(err); }
});

module.exports = router;
