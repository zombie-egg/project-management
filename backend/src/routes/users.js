/**
 * 人员账号管理（仅管理员）
 * 支持：列表、单个/批量创建、编辑、启用/禁用、软删除
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { ok, fail } = require('../utils/resp');
const { authRequired, adminOnly } = require('../middleware/auth');
const { writeLog } = require('../utils/logger');

const router = express.Router();
router.use(authRequired, adminOnly);

// 列表（技术员账号，支持关键词）
router.get('/', (req, res) => {
  const { keyword = '', role = '' } = req.query;
  let sql = `SELECT id, username, name, role, phone, status, created_at FROM users WHERE deleted=0`;
  const params = [];
  if (role) { sql += ` AND role=?`; params.push(role); }
  if (keyword) {
    sql += ` AND (username LIKE ? OR name LIKE ? OR phone LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  sql += ` ORDER BY id DESC`;
  const list = db.prepare(sql).all(...params);
  return ok(res, list);
});

// 创建单个技术员
router.post('/', (req, res) => {
  const { username, password, name, phone, status = 1 } = req.body || {};
  if (!username || !password || !name) return fail(res, '账号、密码、姓名为必填');
  const exists = db.prepare(`SELECT id FROM users WHERE username=?`).get(username);
  if (exists) return fail(res, `账号 ${username} 已存在`);

  const info = db.prepare(
    `INSERT INTO users (username, password, name, role, phone, status) VALUES (?,?,?,?,?,?)`
  ).run(username, bcrypt.hashSync(password, 10), name, 'tech', phone || '', status ? 1 : 0);

  writeLog({ user: req.user, action: 'create_user', targetType: 'user', targetId: info.lastInsertRowid, detail: `创建账号 ${username}` });
  return ok(res, {
    id: info.lastInsertRowid,
    account: {
      username,
      password,
      name,
      role: 'tech',
      status: status ? 1 : 0
    }
  }, '创建成功');
});

// 批量创建技术员
router.post('/batch', (req, res) => {
  const { list } = req.body || {};
  if (!Array.isArray(list) || list.length === 0) return fail(res, '批量列表不能为空');

  const insert = db.prepare(
    `INSERT INTO users (username, password, name, role, phone, status) VALUES (?,?,?,?,?,?)`
  );
  const results = { success: 0, created: [], failed: [] };
  const tx = db.transaction((items) => {
    for (const it of items) {
      if (!it.username || !it.password || !it.name) { results.failed.push({ ...it, reason: '缺少必填字段' }); continue; }
      const exists = db.prepare(`SELECT id FROM users WHERE username=?`).get(it.username);
      if (exists) { results.failed.push({ ...it, reason: '账号已存在' }); continue; }
      const info = insert.run(it.username, bcrypt.hashSync(it.password, 10), it.name, 'tech', it.phone || '', it.status === 0 ? 0 : 1);
      results.success++;
      results.created.push({
        id: info.lastInsertRowid,
        username: it.username,
        password: it.password,
        name: it.name,
        role: 'tech',
        status: it.status === 0 ? 0 : 1
      });
    }
  });
  tx(list);
  writeLog({ user: req.user, action: 'batch_create_user', targetType: 'user', detail: `批量创建 ${results.success} 个账号` });
  return ok(res, results, `成功 ${results.success} 个，失败 ${results.failed.length} 个`);
});

// 编辑技术员（可含重置密码）
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare(`SELECT * FROM users WHERE id=? AND deleted=0`).get(id);
  if (!user) return fail(res, '用户不存在', 404);

  const { name, phone, status, password } = req.body || {};
  const fields = [];
  const params = [];
  if (name !== undefined) { fields.push('name=?'); params.push(name); }
  if (phone !== undefined) { fields.push('phone=?'); params.push(phone); }
  if (status !== undefined) { fields.push('status=?'); params.push(status ? 1 : 0); }
  if (password) { fields.push('password=?'); params.push(bcrypt.hashSync(password, 10)); }
  if (fields.length === 0) return fail(res, '没有可更新的字段');
  fields.push(`updated_at=datetime('now','localtime')`);
  params.push(id);
  db.prepare(`UPDATE users SET ${fields.join(',')} WHERE id=?`).run(...params);

  writeLog({ user: req.user, action: 'update_user', targetType: 'user', targetId: id, detail: `编辑账号 ${user.username}` });
  return ok(res, null, '更新成功');
});

// 启用/禁用
router.patch('/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  const user = db.prepare(`SELECT * FROM users WHERE id=? AND deleted=0`).get(id);
  if (!user) return fail(res, '用户不存在', 404);
  if (user.role === 'admin') return fail(res, '不能禁用管理员账号');
  db.prepare(`UPDATE users SET status=?, updated_at=datetime('now','localtime') WHERE id=?`).run(status ? 1 : 0, id);
  writeLog({ user: req.user, action: 'toggle_user_status', targetType: 'user', targetId: id, detail: `${status ? '启用' : '禁用'} 账号 ${user.username}` });
  return ok(res, null, '操作成功');
});

// 软删除
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare(`SELECT * FROM users WHERE id=? AND deleted=0`).get(id);
  if (!user) return fail(res, '用户不存在', 404);
  if (user.role === 'admin') return fail(res, '不能删除管理员账号');
  db.prepare(`UPDATE users SET deleted=1, updated_at=datetime('now','localtime') WHERE id=?`).run(id);
  writeLog({ user: req.user, action: 'delete_user', targetType: 'user', targetId: id, detail: `删除账号 ${user.username}` });
  return ok(res, null, '删除成功');
});

module.exports = router;
