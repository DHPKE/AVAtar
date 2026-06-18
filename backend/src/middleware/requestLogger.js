const RESET  = '\x1b[0m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';

/**
 * Minimal request logger — no external dependency.
 * Logs: METHOD /path STATUS Xms
 */
function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const ms     = Date.now() - start;
    const status = res.statusCode;
    const color  = status >= 500 ? RED
                 : status >= 400 ? YELLOW
                 : status >= 200 ? GREEN
                 : CYAN;

    const ts = new Date().toISOString().slice(11, 19); // HH:MM:SS
    console.log(
      `${DIM}${ts}${RESET} ${color}${req.method.padEnd(6)}${RESET}` +
      ` ${req.originalUrl.padEnd(40)} ${color}${status}${RESET}` +
      ` ${DIM}${ms}ms${RESET}`
    );
  });

  next();
}

module.exports = { requestLogger };
