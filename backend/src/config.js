require('dotenv').config();

const config = {
  port:    parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev:   (process.env.NODE_ENV || 'development') === 'development',

  jwt: {
    secret:    process.env.JWT_SECRET    || 'dev-secret-CHANGE-IN-PRODUCTION',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  db: {
    path: process.env.DB_PATH || './data/avatar.db',
  },

  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    email:    process.env.ADMIN_EMAIL    || 'admin@local.host',
    password: process.env.ADMIN_PASSWORD || 'changeme123',
  },

  uploads: {
    dir:       process.env.UPLOADS_DIR        || './uploads',
    maxSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10),
  },

  smtp: {
    host:   process.env.SMTP_HOST   || '',
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user:   process.env.SMTP_USER   || '',
    pass:   process.env.SMTP_PASS   || '',
    from:   process.env.SMTP_FROM   || 'avatar@local.host',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
};

// Hard-fail in production if the JWT secret was never changed
if (!config.isDev && config.jwt.secret === 'dev-secret-CHANGE-IN-PRODUCTION') {
  console.error('[CONFIG] FATAL: JWT_SECRET must be set to a strong secret in production.');
  process.exit(1);
}

module.exports = config;
