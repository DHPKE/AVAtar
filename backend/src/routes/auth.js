const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const config  = require('../config');
const { getDb }        = require('../db/init');
const { authenticate } = require('../middleware/authenticate');
const { createError }  = require('../middleware/errorHandler');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip password_hash before sending user data to client */
function sanitiseUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

/** Issue a signed JWT for a user row */
function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

/**
 * Body: { username, password }
 * Returns: { token, user }
 */
router.post('/login', (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return next(createError(400, 'Benutzername und Passwort erforderlich'));
    }

    const db   = getDb();
    const user = db.prepare(
      'SELECT * FROM users WHERE username = ? AND active = 1'
    ).get(username);

    // Constant-time check even when user not found (prevent user enumeration)
    const hash    = user?.password_hash ?? '$2a$12$invalidhashusedfortimingnull';
    const isValid = bcrypt.compareSync(password, hash);

    if (!user || !isValid) {
      return next(createError(401, 'Ungültige Anmeldedaten'));
    }

    const token = signToken(user);

    res.json({
      token,
      expiresIn: config.jwt.expiresIn,
      user: sanitiseUser(user),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

/**
 * Returns the currently authenticated user.
 * Frontend uses this on app load to restore session.
 */
router.get('/me', authenticate, (req, res, next) => {
  try {
    const db   = getDb();
    const user = db.prepare(
      'SELECT * FROM users WHERE id = ? AND active = 1'
    ).get(req.user.sub);

    if (!user) {
      return next(createError(401, 'Benutzer nicht gefunden oder deaktiviert'));
    }

    res.json({ user: sanitiseUser(user) });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────

/**
 * Body: { currentPassword, newPassword }
 * Any authenticated user can change their own password.
 */
router.post('/change-password', authenticate, (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return next(createError(400, 'Aktuelles und neues Passwort erforderlich'));
    }

    if (newPassword.length < 8) {
      return next(createError(400, 'Neues Passwort muss mindestens 8 Zeichen lang sein'));
    }

    const db   = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.sub);

    if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return next(createError(401, 'Aktuelles Passwort ist falsch'));
    }

    const newHash = bcrypt.hashSync(newPassword, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);

    res.json({ message: 'Passwort erfolgreich geändert' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
