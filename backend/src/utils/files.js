const fs = require('fs');
const crypto = require('crypto');

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function safeUnlink(filePath) {
  if (!filePath) return;
  fs.promises.unlink(filePath).catch(() => {});
}

function cleanupMulterFiles(files) {
  if (!files) return;
  const list = Array.isArray(files) ? files : Object.values(files).flat();
  for (const file of list) safeUnlink(file.path);
}

module.exports = { sha256File, safeUnlink, cleanupMulterFiles };
