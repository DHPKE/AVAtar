require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const config                            = require('./config');
const { initDb, closeDb }               = require('./db/init');
const { requestLogger }                 = require('./middleware/requestLogger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const healthRouter        = require('./routes/health');
const authRouter          = require('./routes/auth');
const articlesRouter      = require('./routes/articles');
const categoriesRouter    = require('./routes/categories');
const suppliersRouter     = require('./routes/suppliers');
const movementsRouter     = require('./routes/movements');
const rentalsRouter       = require('./routes/rentals');
const notificationsRouter = require('./routes/notifications');
const usersRouter         = require('./routes/users');
const settingsRouter      = require('./routes/settings');
const exportRouter        = require('./routes/export');

// ─── Bootstrap ───────────────────────────────────────────────────────────────

function createApp() {
  const app = express();

  // ── Core middleware ────────────────────────────────────────────────────────
  app.use(cors({
    origin:      config.isDev ? '*' : config.cors.origin,
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  // ── Static: uploaded article images ───────────────────────────────────────
  app.use('/uploads', express.static(path.resolve(config.uploads.dir)));

  // ── API Routes ─────────────────────────────────────────────────────────────
  app.use('/api/health',        healthRouter);
  app.use('/api/auth',          authRouter);
  app.use('/api/articles',      articlesRouter);
  app.use('/api/categories',    categoriesRouter);
  app.use('/api/suppliers',     suppliersRouter);
  app.use('/api/movements',     movementsRouter);
  app.use('/api/rentals',       rentalsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/users',         usersRouter);
  app.use('/api/settings',      settingsRouter);
  app.use('/api/export',        exportRouter);

  // ── API 404 — must come BEFORE SPA fallback ──────────────────────────────
  app.use('/api', notFoundHandler);

  // ── Serve built frontend in production ─────────────────────────────────────
  const publicDir = path.resolve(__dirname, '../public');
  if (!config.isDev) {
    app.use(express.static(publicDir));
    // SPA fallback — Vue Router handles client-side routing
    app.get('*', (req, res) => {
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  }

  // ── Global error handler (always last) ────────────────────────────────────
  app.use(errorHandler);

  return app;
}

// ─── Start ───────────────────────────────────────────────────────────────────

function start() {
  initDb();

  const app    = createApp();
  const server = app.listen(config.port, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════╗');
    console.log('  ║         AVAtar — Lagerverwaltung     ║');
    console.log('  ╚══════════════════════════════════════╝');
    console.log('');
    console.log(`  Server  →  http://localhost:${config.port}`);
    console.log(`  Health  →  http://localhost:${config.port}/api/health`);
    console.log(`  Mode    →  ${config.nodeEnv}`);
    if (!config.isDev) {
      console.log(`  UI      →  http://localhost:${config.port}`);
    }
    console.log('');
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  function shutdown(signal) {
    console.log(`\n[AVAtar] ${signal} received — shutting down gracefully...`);
    server.close(() => {
      closeDb();
      console.log('[AVAtar] Bye.');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('[AVAtar] Forced exit after timeout');
      process.exit(1);
    }, 10_000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('uncaughtException',  (err)    => { console.error('[AVAtar] Uncaught exception:', err);    shutdown('uncaughtException'); });
  process.on('unhandledRejection', (reason) => { console.error('[AVAtar] Unhandled rejection:', reason); });
}

start();
