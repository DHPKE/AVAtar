const jwt    = require('jsonwebtoken');
const config = require('../config');
const { createError } = require('./errorHandler');

/**
 * Verifies the Bearer token in the Authorization header.
 * On success, attaches the decoded payload to req.user:
 *   { sub, username, role, iat, exp }
 *
 * Usage:
 *   router.get('/protected', authenticate, handler)
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(createError(401, 'Authentifizierung erforderlich'));
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(createError(401, 'Sitzung abgelaufen — bitte neu anmelden'));
    }
    return next(createError(401, 'Ungültiges Token'));
  }
}

module.exports = { authenticate };
