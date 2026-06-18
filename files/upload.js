const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const config = require('../config');
const { createError } = require('./errorHandler');

// Ensure uploads directory exists at startup
const uploadsDir = path.resolve(config.uploads.dir);
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),

  filename: (req, file, cb) => {
    const ext      = path.extname(file.originalname).toLowerCase();
    const articleId = req.params.id ?? 'new';
    cb(null, `article-${articleId}-${Date.now()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(createError(400, 'Nur JPEG, PNG und WebP erlaubt'), false);
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.uploads.maxSizeMb * 1024 * 1024 },
});

module.exports = upload;
