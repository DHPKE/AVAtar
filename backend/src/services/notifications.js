const { getDb }    = require('../db/init');
const { sendMail } = require('./mailer');
const config       = require('../config');

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns all active articles that are at or below their minimum stock threshold.
 * Handles both piece/bundle (stock_qty) and cable (stock_meters) articles.
 */
function getLowStockArticles() {
  const db = getDb();
  return db.prepare(`
    SELECT
      a.*,
      c.name  AS category_name,
      s.name  AS supplier_name,
      s.email AS supplier_email,
      s.phone AS supplier_phone
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN suppliers  s ON a.supplier_id  = s.id
    WHERE a.active   = 1
      AND a.min_stock > 0
      AND (
        (a.unit = 'meter' AND a.stock_meters <= a.min_stock) OR
        (a.unit != 'meter' AND a.stock_qty   <= a.min_stock)
      )
    ORDER BY s.name NULLS LAST, a.name
  `).all();
}

/**
 * Returns the low-stock articles grouped by supplier —
 * ready to hand off to a buyer or to render in the Admin UI.
 *
 * @returns {{ supplier_name, supplier_email, supplier_phone, articles[] }[]}
 */
function getReorderList() {
  const articles  = getLowStockArticles();
  const bySupplier = {};

  for (const art of articles) {
    const key = art.supplier_id ? art.supplier_name : '_none_';
    if (!bySupplier[key]) {
      bySupplier[key] = {
        supplier_name:  art.supplier_id ? art.supplier_name  : 'Kein Lieferant',
        supplier_email: art.supplier_id ? art.supplier_email : null,
        supplier_phone: art.supplier_id ? art.supplier_phone : null,
        articles: [],
      };
    }
    bySupplier[key].articles.push(art);
  }

  return Object.values(bySupplier);
}

// ─── Email template ───────────────────────────────────────────────────────────

function _stockDisplay(art) {
  return art.unit === 'meter'
    ? `${art.stock_meters} m`
    : `${art.stock_qty} Stk`;
}

function _minDisplay(art) {
  return art.unit === 'meter'
    ? `${art.min_stock} m`
    : `${art.min_stock} Stk`;
}

function buildReorderEmailHtml(reorderList) {
  const total = reorderList.reduce((n, g) => n + g.articles.length, 0);
  const date  = new Date().toLocaleDateString('de-AT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const supplierBlocks = reorderList.map(group => {
    const contactLine = [group.supplier_email, group.supplier_phone]
      .filter(Boolean).join(' · ');

    const rows = group.articles.map(art => `
      <tr>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:13px;">${art.article_number}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;">${art.name}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;color:#DC2626;font-weight:600;">${_stockDisplay(art)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;color:#6B7280;">${_minDisplay(art)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;color:#6B7280;">${art.location || '—'}</td>
      </tr>`).join('');

    return `
      <h3 style="margin:28px 0 4px;color:#008FD0;font-size:15px;">${group.supplier_name}</h3>
      ${contactLine ? `<p style="margin:0 0 8px;font-size:13px;color:#6B7280;">${contactLine}</p>` : ''}
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#F3F4F6;">
            <th style="padding:7px 10px;text-align:left;font-weight:600;color:#374151;">Art.-Nr.</th>
            <th style="padding:7px 10px;text-align:left;font-weight:600;color:#374151;">Bezeichnung</th>
            <th style="padding:7px 10px;text-align:left;font-weight:600;color:#374151;">Bestand</th>
            <th style="padding:7px 10px;text-align:left;font-weight:600;color:#374151;">Minimum</th>
            <th style="padding:7px 10px;text-align:left;font-weight:600;color:#374151;">Lagerort</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="de">
<body style="margin:0;padding:0;background:#F9FAFB;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <div style="max-width:700px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #E5E7EB;">

    <div style="background:#008FD0;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;letter-spacing:0.02em;">AVAtar — Mindestbestand unterschritten</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">${date}</p>
    </div>

    <div style="padding:24px 32px;">
      <p style="margin:0 0 20px;font-size:15px;">
        <strong>${total} Artikel</strong> haben den Mindestbestand erreicht oder unterschritten.
      </p>
      ${supplierBlocks}
    </div>

    <div style="background:#F3F4F6;padding:16px 32px;border-top:1px solid #E5E7EB;">
      <p style="margin:0;font-size:12px;color:#9CA3AF;">
        AVAtar Lagerverwaltung · automatische Benachrichtigung
      </p>
    </div>

  </div>
</body>
</html>`;
}

// ─── Main check ───────────────────────────────────────────────────────────────

/**
 * Runs the low-stock check and sends an email if articles are below threshold.
 *
 * @param {string|null} notifyEmail  Override recipient — falls back to SMTP_FROM
 * @returns {{ sent, skipped, low_stock_count, reorder_list }}
 */
async function runLowStockCheck(notifyEmail) {
  const reorderList = getReorderList();
  const total       = reorderList.reduce((n, g) => n + g.articles.length, 0);

  if (total === 0) {
    console.log('[Notifications] Mindestbestand-Check: alle Bestände OK');
    return { sent: false, skipped: false, low_stock_count: 0, reorder_list: [] };
  }

  const html   = buildReorderEmailHtml(reorderList);
  const to     = notifyEmail || config.smtp.from;
  const result = await sendMail({
    to,
    subject: `AVAtar: ${total} Artikel unter Mindestbestand`,
    html,
    text: `${total} Artikel haben den Mindestbestand unterschritten. Bitte AVAtar für Details öffnen.`,
  });

  console.log(`[Notifications] ${total} Artikel unter Minimum — E-Mail ${result.skipped ? 'übersprungen (kein SMTP)' : 'gesendet an ' + to}`);

  return {
    sent:            !result.skipped,
    skipped:         result.skipped ?? false,
    low_stock_count: total,
    reorder_list:    reorderList,
  };
}

module.exports = { getLowStockArticles, getReorderList, buildReorderEmailHtml, runLowStockCheck };
