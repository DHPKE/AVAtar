require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const config                            = require('./config');
const { initDb, closeDb }               = require('./db/init');
const { requestLogger }                 = require('./middleware/requestLogger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const healthRouter                      = require('./routes/health');
const authRouter                        = require('./routes/auth');

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
  app.use('/api/health', healthRouter);
  app.use('/api/auth',   authRouter);

  // Phase 3+: articles, movements, rentals, users will be added here
  // app.use('/api/articles',  articlesRouter);
  // app.use('/api/movements', movementsRouter);
  // app.use('/api/rentals',   rentalsRouter);
  // app.use('/api/users',     usersRouter);

  // ── Catch-all handlers (must be last) ─────────────────────────────────────
  app.use(notFoundHandler);
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

    // Force exit after 10 s if connections don't drain
    setTimeout(() => {
      console.error('[AVAtar] Forced exit after timeout');
      process.exit(1);
    }, 10_000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    console.error('[AVAtar] Uncaught exception:', err);
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[AVAtar] Unhandled rejection:', reason);
  });
}

start();
