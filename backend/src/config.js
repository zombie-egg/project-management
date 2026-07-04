/**
 * 全局配置
 * 可通过环境变量覆盖，方便部署到不同环境。
 */
const path = require('path');

const dataRoot = process.env.DATA_DIR
  || (process.env.NODE_ENV === 'production' ? '/data' : path.join(__dirname, '..', 'data'));

module.exports = {
  // 服务端口
  PORT: process.env.PORT || 3000,
  // JWT 密钥（生产环境务必通过环境变量覆盖）
  JWT_SECRET: process.env.JWT_SECRET || 'project-admin-secret-key-change-in-prod',
  // token 有效期
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '12h',
  // SQLite 数据库文件路径
  DB_PATH: process.env.DB_PATH || path.join(dataRoot, 'app.db'),
  // 文件上传根目录（可在系统设置中动态修改，此处为默认值）
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.join(dataRoot, 'uploads'),
  // 单文件最大限制：200MB
  MAX_FILE_SIZE: 200 * 1024 * 1024,
  // 允许上传的文件类型（文档 / 图片 / 视频）
  ALLOWED_MIME_PREFIXES: ['image/', 'video/'],
  ALLOWED_EXTENSIONS: [
    // 文档
    '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.pdf', '.txt', '.md', '.csv', '.zip', '.rar', '.7z',
    // 图片
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg',
    // 视频
    '.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm'
  ]
};
