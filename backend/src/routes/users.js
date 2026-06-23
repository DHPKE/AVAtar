const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { getDb }          = require('../db/init');
const { authenticate }   = require('../middleware/authenticate');
const { requireMinRole } = require('../middleware/requireRole');
const { createError }    = require('../middleware/errorHandler');

router.use(authenticate, requireMinRole('admin'));

/** Strips both secret hashes — pin_hash guards only a 5-digit PIN (100k
 *  combinations), so leaking it to any client would make offline brute-
 *  force trivial despite bcrypt. */
function sanitise(user) {
  const { password_hash, pin_hash, ...safe } = user;
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

/** Validates a 5-digit PIN; returns the trimmed string or throws */
function validatePin(raw) {
  const pin = String(raw ?? '').trim();
  if (!/^[0-9]{5}$/.test(pin)) {
    throw Object.assign(new Error('PIN muss genau 5 Ziffern sein'), { status: 400 });
  }
  return pin;
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
    const { username, email, password, role = 'staff', department, shortcode, pin } = req.body;

    if (!username?.trim()) return next(createError(400, 'Benutzername erforderlich'));
    if (!email?.trim())    return next(createError(400, 'E-Mail erforderlich'));
    if (!password)         return next(createError(400, 'Passwort erforderlich'));
    if (password.length < 8) return next(createError(400, 'Passwort mindestens 8 Zeichen'));

    const VALID_ROLES = ['staff', 'warehouse_manager', 'admin'];
    if (!VALID_ROLES.includes(role)) {
      return next(createError(400, `Ungültige Rolle. Erlaubt: ${VALID_ROLES.join(', ')}`));
    }

    const code    = normaliseShortcode(shortcode);
    const pinHash = (pin !== undefined && pin !== '') ? bcrypt.hashSync(validatePin(pin), 12) : null;

    const db   = getDb();
    const hash = bcrypt.hashSync(password, 12);

    const { lastInsertRowid } = db.prepare(`
      INSERT INTO users (username, email, password_hash, role, department, shortcode, pin_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(username.trim(), email.trim(), hash, role, department?.trim() || null, code, pinHash);

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

    const { email, role, active, shortcode, department } = req.body;
    const VALID_ROLES = ['staff', 'warehouse_manager', 'admin'];
    if (role && !VALID_ROLES.includes(role)) {
      return next(createError(400, `Ungültige Rolle. Erlaubt: ${VALID_ROLES.join(', ')}`));
    }

    // Admin cannot deactivate themselves
    if (req.user.sub === user.id && active === false) {
      return next(createError(400, 'Eigenen Account nicht deaktivierbar'));
    }

    const code = shortcode !== undefined ? normaliseShortcode(shortcode) : user.shortcode;

    // Clearing the shortcode invalidates any PIN tied to it
    const pinHash = (shortcode !== undefined && code === null) ? null : user.pin_hash;

    db.prepare(`
      UPDATE users SET email = ?, role = ?, active = ?, shortcode = ?, pin_hash = ?, department = ? WHERE id = ?
    `).run(
      email      ?? user.email,
      role       ?? user.role,
      active !== undefined ? (active ? 1 : 0) : user.active,
      code,
      pinHash,
      department !== undefined ? (department?.trim() || null) : user.department,
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

// ─── POST /api/users/:id/set-pin ──────────────────────────────────────────────
/** Sets or resets the 5-digit PIN used for Kürzel-Login. Requires shortcode. */
router.post('/:id/set-pin', (req, res, next) => {
  try {
    const { pin } = req.body;
    const validPin = validatePin(pin); // throws 400 if not exactly 5 digits

    const db   = getDb();
    const user = db.prepare('SELECT id, shortcode FROM users WHERE id = ?').get(req.params.id);
    if (!user) return next(createError(404, 'Benutzer nicht gefunden'));
    if (!user.shortcode) {
      return next(createError(400, 'Benutzer hat kein Kürzel — PIN ohne Kürzel-Login nicht sinnvoll'));
    }

    const hash = bcrypt.hashSync(validPin, 12);
    db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hash, user.id);

    res.json({ message: 'PIN erfolgreich gesetzt' });
  } catch (err) { next(err); }
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
      return next(createError(400, 'Eigenen Account nicht deaktivierbar'));
    }

    db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(user.id);
    res.json({ message: 'Benutzer deaktiviert' });
  } catch (err) { next(err); }
});

module.exports = router;
