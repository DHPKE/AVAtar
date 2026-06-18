const nodemailer = require('nodemailer');
const config     = require('../config');

/** Lazily created transport — null when SMTP is not configured */
let _transport = null;

function getTransport() {
  if (_transport) return _transport;
  if (!config.smtp.host) return null;

  _transport = nodemailer.createTransport({
    host:   config.smtp.host,
    port:   config.smtp.port,
    secure: config.smtp.secure,
    ...(config.smtp.user ? {
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    } : {}),
  });

  return _transport;
}

/**
 * Send an email.
 * When SMTP is not configured, logs the intent and returns { skipped: true }
 * so the rest of the application continues normally.
 *
 * @param {{ to: string, subject: string, html: string, text?: string }} options
 */
async function sendMail({ to, subject, html, text }) {
  const transport = getTransport();

  if (!transport) {
    console.log('[MAIL] SMTP nicht konfiguriert — E-Mail wird übersprungen');
    console.log(`[MAIL] An: ${to} | Betreff: ${subject}`);
    return { skipped: true };
  }

  try {
    const info = await transport.sendMail({
      from:    config.smtp.from,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
    });
    console.log(`[MAIL] Gesendet: ${info.messageId} → ${to}`);
    return info;
  } catch (err) {
    console.error('[MAIL] Fehler beim Senden:', err.message);
    throw err;
  }
}

/**
 * Verify SMTP connection — useful for the health endpoint or admin settings page.
 * Returns { ok: true } or { ok: false, error: string }
 */
async function verifyTransport() {
  const transport = getTransport();
  if (!transport) return { ok: false, error: 'SMTP nicht konfiguriert' };

  try {
    await transport.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { sendMail, verifyTransport };
