const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { AppError } = require('./errorHandler');

const privateRoot = path.join(__dirname, '../../storage/private');
const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

function uploader(folderName) {
  const directory = path.join(privateRoot, folderName);
  fs.mkdirSync(directory, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, directory),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`);
      },
    }),
    limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 5) * 1024 * 1024 },
    fileFilter: (_req, file, cb) => allowed.has(file.mimetype)
      ? cb(null, true)
      : cb(new AppError('Only PDF, JPG, PNG and WEBP files are accepted.', 400, 'INVALID_FILE_TYPE')),
  });
}

const customerDocuments = uploader('customer-documents');
const fieldDocuments = uploader('field-documents');
const paymentSlips = uploader('payment-slips');

module.exports = {
  customerDocuments,
  fieldDocuments,
  paymentSlips,
  privateRoot,
};
