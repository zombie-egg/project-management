/**
 * 服务入口
 * - 统一异常拦截
 * - token 鉴权 + 权限校验（各路由内实现）
 */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const db = require('./db');
const seed = require('./db/seed');

// 首次启动自动初始化 + seed（幂等）
seed();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 确保上传目录存在
if (!fs.existsSync(config.UPLOAD_DIR)) fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/files', require('./routes/files'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/ledger', require('./routes/ledger'));
app.use('/api', require('./routes/misc'));

// 健康检查
app.get('/api/health', (req, res) => res.json({ code: 0, message: 'ok', data: { time: new Date().toISOString() } }));

// 404
app.use((req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在', data: null });
});

// 全局异常拦截
app.use((err, req, res, next) => {
  console.error('未捕获异常:', err);
  const msg = err && err.message ? err.message : '服务器内部错误';
  res.status(500).json({ code: 500, message: msg, data: null });
});

app.listen(config.PORT, () => {
  console.log(`🚀 项目接单管理后台 API 已启动: http://localhost:${config.PORT}`);
  console.log(`   健康检查: http://localhost:${config.PORT}/api/health`);
});

module.exports = app;
