const router = require('express').Router();
const { getDb } = require('../db/init');

/**
 * GET /api/health
 * Returns server status and a lightweight DB probe.
 * Useful for monitoring and as a smoke-test after deploy.
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();

    // Lightweight probe — one indexed read per core table
    const { user_count }     = db.prepare('SELECT COUNT(*) AS user_count FROM users').get();
    const { article_count }  = db.prepare('SELECT COUNT(*) AS article_count FROM articles').get();
    const { movement_count } = db.prepare('SELECT COUNT(*) AS movement_count FROM movements').get();

    res.json({
      status:    'ok',
      project:   'AVAtar',
      version:   '0.1.0',
      timestamp: new Date().toISOString(),
      db: {
        status:    'ok',
        users:     user_count,
        articles:  article_count,
        movements: movement_count,
      },
    });
  } catch (err) {
    res.status(503).json({
      status:  'error',
      message: err.message,
    });
  }
});

module.exports = router;
