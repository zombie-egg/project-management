/**
 * 鉴权中间件
 * - authRequired：校验 token，注入 req.user
 * - adminOnly：仅管理员可访问
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ code: 401, message: '未登录或token缺失' });
  }
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    // 实时校验账号是否存在/启用
    const user = db.prepare(
      `SELECT id, username, name, role, status, deleted FROM users WHERE id=?`
    ).get(payload.id);
    if (!user || user.deleted === 1) {
      return res.status(401).json({ code: 401, message: '账号不存在' });
    }
    if (user.status === 0) {
      return res.status(403).json({ code: 403, message: '账号已被禁用' });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ code: 401, message: 'token无效或已过期' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ code: 403, message: '需要管理员权限' });
  }
  next();
}

module.exports = { authRequired, adminOnly };
