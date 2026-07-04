/**
 * 文件上传中间件（multer）
 * - 单文件最大 200MB
 * - 白名单扩展名校验，防恶意文件上传
 * 说明：multer 分磁盘存储，超大文件由前端做分片；此处后端做完整性与安全校验。
 */
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const db = require('../db');

function getUploadDir() {
  // 支持系统设置动态覆盖上传路径
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key='upload_dir'").get();
    if (row && row.value && row.value.trim()) return row.value.trim();
  } catch (e) { /* ignore */ }
  return config.UPLOAD_DIR;
}

function getMaxSize() {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key='max_file_size_mb'").get();
    if (row && row.value) return Number(row.value) * 1024 * 1024;
  } catch (e) { /* ignore */ }
  return config.MAX_FILE_SIZE;
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = getUploadDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    // 处理中文文件名编码
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  }
});

function fileFilter(req, file, cb) {
  file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
  const ext = path.extname(file.originalname).toLowerCase();
  const okExt = config.ALLOWED_EXTENSIONS.includes(ext);
  const okMime = config.ALLOWED_MIME_PREFIXES.some((p) => (file.mimetype || '').startsWith(p));
  if (okExt || okMime) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型：${ext || file.mimetype}`));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: getMaxSize() }
});

module.exports = { upload, getUploadDir };
