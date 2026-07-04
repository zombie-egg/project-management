/**
 * 认证相关路由：登录、获取当前用户信息、修改密码
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');
const { ok, fail } = require('../utils/resp');
const { authRequired } = require('../middleware/auth');
const { writeLog } = require('../utils/logger');

const router = express.Router();

// 登录
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return fail(res, '账号和密码不能为空');

  const user = db.prepare(
    `SELECT * FROM users WHERE username=? AND deleted=0`
  ).get(username);
  if (!user) return fail(res, '账号或密码错误', 401);
  if (user.status === 0) return fail(res, '账号已被禁用，请联系管理员', 403);
  if (!bcrypt.compareSync(password, user.password)) return fail(res, '账号或密码错误', 401);

  const token = jwt.sign(
    { id: user.id, role: user.role, username: user.username },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );
  writeLog({ user, action: 'login', targetType: 'user', targetId: user.id, detail: '登录系统' });

  return ok(res, {
    token,
    user: { id: user.id, username: user.username, name: user.name, role: user.role, phone: user.phone, bank_account: user.bank_account }
  });
});

// 当前用户信息
router.get('/me', authRequired, (req, res) => {
  const user = db.prepare(
    `SELECT id, username, name, role, phone, bank_account, status, created_at FROM users WHERE id=?`
  ).get(req.user.id);
  return ok(res, user);
});

// 修改自己的银行卡号
router.put('/me/bank-account', authRequired, (req, res) => {
  const { bank_account = '' } = req.body || {};
  db.prepare(`UPDATE users SET bank_account=?, updated_at=datetime('now','localtime') WHERE id=?`)
    .run(String(bank_account).trim(), req.user.id);
  writeLog({ user: req.user, action: 'update_bank_account', targetType: 'user', targetId: req.user.id, detail: '维护银行卡号' });
  return ok(res, null, '保存成功');
});

// 修改自己的密码
router.post('/change-password', authRequired, (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) return fail(res, '旧密码和新密码不能为空');
  if (newPassword.length < 6) return fail(res, '新密码长度至少6位');

  const user = db.prepare(`SELECT * FROM users WHERE id=?`).get(req.user.id);
  if (!bcrypt.compareSync(oldPassword, user.password)) return fail(res, '旧密码错误');

  db.prepare(`UPDATE users SET password=?, updated_at=datetime('now','localtime') WHERE id=?`)
    .run(bcrypt.hashSync(newPassword, 10), req.user.id);
  writeLog({ user: req.user, action: 'change_password', targetType: 'user', targetId: req.user.id, detail: '修改密码' });
  return ok(res, null, '密码修改成功');
});

module.exports = router;
