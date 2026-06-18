const router = require('express').Router();
const { authenticate }   = require('../middleware/authenticate');
const { requireMinRole } = require('../middleware/requireRole');
const { verifyTransport } = require('../services/mailer');
const {
  getLowStockArticles,
  getReorderList,
  runLowStockCheck,
} = require('../services/notifications');

router.use(authenticate);

// ─── GET /api/notifications/low-stock ────────────────────────────────────────
/**
 * Returns articles below min_stock — no email sent.
 * Used by the Admin dashboard warning list.
 */
router.get('/low-stock', requireMinRole('warehouse_manager'), (req, res, next) => {
  try {
    const articles = getLowStockArticles();
    res.json({ articles, total: articles.length });
  } catch (err) { next(err); }
});

// ─── GET /api/notifications/reorder ──────────────────────────────────────────
/**
 * Returns low-stock articles grouped by supplier.
 * Used to generate a printable / exportable reorder list.
 */
router.get('/reorder', requireMinRole('warehouse_manager'), (req, res, next) => {
  try {
    const reorder_list = getReorderList();
    const total        = reorder_list.reduce((n, g) => n + g.articles.length, 0);
    res.json({ reorder_list, total });
  } catch (err) { next(err); }
});

// ─── POST /api/notifications/check ───────────────────────────────────────────
/**
 * Runs the low-stock check and sends an email notification if needed.
 *
 * Body (optional):
 *   notify_email  {string}  Override recipient address
 */
router.post('/check', requireMinRole('warehouse_manager'), async (req, res, next) => {
  try {
    const { notify_email } = req.body ?? {};
    const result = await runLowStockCheck(notify_email ?? null);
    res.json(result);
  } catch (err) { next(err); }
});

// ─── GET /api/notifications/smtp-status ──────────────────────────────────────
/**
 * Verifies the SMTP connection — useful in the admin settings page.
 */
router.get('/smtp-status', requireMinRole('admin'), async (req, res, next) => {
  try {
    const status = await verifyTransport();
    res.json(status);
  } catch (err) { next(err); }
});

module.exports = router;
