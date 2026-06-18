const config = require('../config');

/**
 * 404 handler — must be registered AFTER all routes.
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error:  'Not found',
    path:   req.originalUrl,
    method: req.method,
  });
}

/**
 * Centralised error handler.
 * Express recognises this as an error handler because it has 4 parameters.
 *
 * Usage in routes:  next(err)  or  next(createError(400, 'Bad input'))
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Always log 5xx errors server-side
  if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl} — ${message}`);
    console.error(err.stack);
  }

  res.status(status).json({
    error: message,
    // Only expose stack trace in development
    ...(config.isDev && err.stack ? { stack: err.stack } : {}),
  });
}

/**
 * Helper: create an error with an HTTP status code.
 *
 * @param {number} status
 * @param {string} message
 * @returns {Error}
 */
function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = { notFoundHandler, errorHandler, createError };
