const path = require('path');
const multer = require('multer');
const fs = require('fs');

const reportUploadDir = path.join(__dirname, '..', 'uploads', 'reports');
if (!fs.existsSync(reportUploadDir)) {
  fs.mkdirSync(reportUploadDir, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
]);

const reportStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, reportUploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `report-${Date.now()}-${safeName}`);
  },
});

const uploadReportFile = multer({
  storage: reportStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Invalid file type. Allowed: PDF, JPEG, PNG, WEBP, TXT'));
  },
});

module.exports = { uploadReportFile, reportUploadDir };
