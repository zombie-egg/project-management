/**
 * 杂项路由集合：操作日志、标签、系统设置、技术员业绩、回款逾期统计、到期预警
 * 均需管理员权限
 */
const express = require('express');
const db = require('../db');
const { ok, fail } = require('../utils/resp');
const { authRequired, adminOnly } = require('../middleware/auth');
const { writeLog } = require('../utils/logger');
const { computeProfit, round2 } = require('../utils/profit');
const { PROJECT_TYPE, parseProjectTypeFilter, projectTypeLabel, projectTypeWhere } = require('../utils/projectType');
const dayjs = require('dayjs');

const router = express.Router();
const STATUS_LABEL = {
  pending: '待接单', stage1: '接单', stage2: '初版展示', stage3: '终版修改',
  stage4: '完成源码上传', stage5: '提交付款申请', completed: '已完工'
};

// ==================== 操作日志 ====================
router.get('/logs', authRequired, adminOnly, (req, res) => {
  const q = req.query;
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(q.pageSize) || 20));
  const where = ['1=1'];
  const params = [];
  if (q.action) { where.push('action=?'); params.push(q.action); }
  if (q.user_id) { where.push('user_id=?'); params.push(Number(q.user_id)); }
  if (q.keyword) { where.push('(detail LIKE ? OR user_name LIKE ?)'); params.push(`%${q.keyword}%`, `%${q.keyword}%`); }
  if (q.start_date) { where.push('date(created_at) >= date(?)'); params.push(q.start_date); }
  if (q.end_date) { where.push('date(created_at) <= date(?)'); params.push(q.end_date); }
  const whereSql = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) c FROM logs WHERE ${whereSql}`).get(...params).c;
  const list = db.prepare(`SELECT * FROM logs WHERE ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, pageSize, (page - 1) * pageSize);
  return ok(res, { list, total, page, pageSize });
});

// ==================== 项目标签 ====================
router.get('/tags', authRequired, (req, res) => {
  const list = db.prepare(`SELECT * FROM tags WHERE deleted=0 ORDER BY id`).all();
  return ok(res, list);
});

router.post('/tags', authRequired, adminOnly, (req, res) => {
  const { name, color = '#0071e3' } = req.body || {};
  if (!name) return fail(res, '标签名称不能为空');
  const exists = db.prepare(`SELECT id FROM tags WHERE name=? AND deleted=0`).get(name);
  if (exists) return fail(res, '标签已存在');
  const info = db.prepare(`INSERT INTO tags (name, color) VALUES (?,?)`).run(name, color);
  writeLog({ user: req.user, action: 'create_tag', targetType: 'tag', targetId: info.lastInsertRowid, detail: `创建标签：${name}` });
  return ok(res, { id: info.lastInsertRowid }, '创建成功');
});

router.put('/tags/:id', authRequired, adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const { name, color } = req.body || {};
  const t = db.prepare(`SELECT * FROM tags WHERE id=? AND deleted=0`).get(id);
  if (!t) return fail(res, '标签不存在', 404);
  db.prepare(`UPDATE tags SET name=COALESCE(?,name), color=COALESCE(?,color) WHERE id=?`).run(name || null, color || null, id);
  return ok(res, null, '更新成功');
});

router.delete('/tags/:id', authRequired, adminOnly, (req, res) => {
  const id = Number(req.params.id);
  db.prepare(`UPDATE tags SET deleted=1 WHERE id=?`).run(id);
  db.prepare(`DELETE FROM project_tags WHERE tag_id=?`).run(id);
  writeLog({ user: req.user, action: 'delete_tag', targetType: 'tag', targetId: id, detail: `删除标签 #${id}` });
  return ok(res, null, '删除成功');
});

// ==================== 系统设置 ====================
router.get('/settings', authRequired, adminOnly, (req, res) => {
  const rows = db.prepare(`SELECT key, value FROM settings`).all();
  const obj = {};
  rows.forEach((r) => { obj[r.key] = r.value; });
  return ok(res, obj);
});

router.put('/settings', authRequired, adminOnly, (req, res) => {
  const body = req.body || {};
  const upsert = db.prepare(`INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)`);
  const tx = db.transaction((entries) => {
    for (const [k, v] of entries) upsert.run(k, String(v));
  });
  tx(Object.entries(body));
  writeLog({ user: req.user, action: 'update_settings', targetType: 'settings', detail: `更新系统设置` });
  return ok(res, null, '保存成功');
});

// ==================== 技术员业绩统计（仅统计常规分配项目）====================
router.get('/performance', authRequired, adminOnly, (req, res) => {
  const techs = db.prepare(`SELECT id, username, name, phone, status FROM users WHERE role='tech' AND deleted=0 AND status=1 ORDER BY id`).all();
  const result = techs.map((t) => {
    const projects = db.prepare(
      `SELECT * FROM projects WHERE deleted=0 AND ${projectTypeWhere('', PROJECT_TYPE.NORMAL)} AND tech_id=?`
    ).all(t.id);
    let totalRevenue = 0, totalTechFee = 0, completed = 0;
    for (const p of projects) {
      const { income } = computeProfit(p);
      totalRevenue += income;
      totalTechFee += Number(p.tech_fee) || 0;
      if (p.status === 'completed') completed++;
    }
    const count = projects.length;
    return {
      tech_id: t.id, name: t.name,
      username: t.username,
      phone: t.phone,
      status: t.status,
      projectCount: count,
      completedCount: completed,
      completeRate: count ? round2((completed / count) * 100) : 0,
      totalRevenue: round2(totalRevenue),
      totalTechFee: round2(totalTechFee)
    };
  });
  return ok(res, result);
});

// ==================== 回款逾期统计（已完工但未结算尾款，含旧项目）====================
router.get('/overdue', authRequired, adminOnly, (req, res) => {
  const where = [`deleted=0`, `settled=0`, `(status='completed' OR status='stage5')`];
  const projectType = parseProjectTypeFilter(req.query.project_type);
  if (projectType) where.push(projectTypeWhere('', projectType));
  const rows = db.prepare(
    `SELECT * FROM projects WHERE ${where.join(' AND ')}`
  ).all();
  const today = dayjs();
  const list = rows.map((p) => {
    const { income } = computeProfit(p);
    const unpaid = round2((Number(p.total_reward) || 0) - income);
    // 逾期天数：以实际完工时间（无则创建时间）为基准
    const base = p.actual_finish_time || p.created_at;
    const overdueDays = base ? today.diff(dayjs(base), 'day') : 0;
    return {
      id: p.id, name: p.name, project_type: p.project_type, project_type_label: projectTypeLabel(p.project_type),
      customer_name: p.customer_name, customer_phone: p.customer_phone,
      total_reward: Number(p.total_reward) || 0, received: income,
      unpaid, overdueDays: overdueDays > 0 ? overdueDays : 0,
      actual_finish_time: p.actual_finish_time
    };
  }).filter((x) => x.unpaid > 0)
    .sort((a, b) => b.overdueDays - a.overdueDays);
  return ok(res, list);
});

// ==================== 服务器 / 维护费到期预警 ====================
router.get('/expire-warning', authRequired, adminOnly, (req, res) => {
  const days = Number(req.query.days) || 30; // 默认预警未来30天内到期
  const rows = db.prepare(
    `SELECT id, name, customer_name, server_expire_date, server_owner, maintenance_expire_date FROM projects
     WHERE deleted=0
       AND ((server_expire_date IS NOT NULL AND server_expire_date != '')
        OR (maintenance_expire_date IS NOT NULL AND maintenance_expire_date != ''))`
  ).all();
  const today = dayjs();
  const list = [];
  for (const p of rows) {
    if (p.server_expire_date) {
      const remain = dayjs(p.server_expire_date).diff(today, 'day');
      if (remain <= days) list.push({ ...p, warning_type: 'server', warning_label: '服务器', expire_date: p.server_expire_date, remainDays: remain, expired: remain < 0 });
    }
    if (p.maintenance_expire_date) {
      const remain = dayjs(p.maintenance_expire_date).diff(today, 'day');
      if (remain <= days) list.push({ ...p, warning_type: 'maintenance', warning_label: '维护费', expire_date: p.maintenance_expire_date, remainDays: remain, expired: remain < 0 });
    }
  }
  list
    .sort((a, b) => a.remainDays - b.remainDays);
  return ok(res, list);
});

// ==================== 旧项目台账专项统计 ====================
router.get('/maintenance-report', authRequired, adminOnly, (req, res) => {
  const where = [`deleted=0`, projectTypeWhere('', PROJECT_TYPE.HISTORY)];
  const params = [];
  if (req.query.start_date) { where.push(`date(actual_finish_time) >= date(?)`); params.push(req.query.start_date); }
  if (req.query.end_date) { where.push(`date(actual_finish_time) <= date(?)`); params.push(req.query.end_date); }
  const rows = db.prepare(
    `SELECT * FROM projects WHERE ${where.join(' AND ')} ORDER BY actual_finish_time DESC, id DESC`
  ).all(...params);
  let totalIncome = 0, totalProfit = 0, totalCost = 0;
  const list = rows.map((p) => {
    const { income, profit } = computeProfit(p);
    totalIncome += income;
    totalProfit += profit;
    totalCost += (Number(p.project_cost) || 0) + (Number(p.tech_fee) || 0);
    return {
      id: p.id, name: p.name, customer_name: p.customer_name, customer_phone: p.customer_phone,
      total_reward: Number(p.total_reward) || 0, income, profit,
      maintenance_amount: Number(p.maintenance_amount) || 0,
      actual_finish_time: p.actual_finish_time, settled: p.settled, remark: p.remark,
      project_type: 2, project_type_label: projectTypeLabel(2)
    };
  });
  return ok(res, {
    list,
    summary: {
      count: list.length,
      totalIncome: round2(totalIncome),
      totalCost: round2(totalCost),
      totalProfit: round2(totalProfit)
    }
  });
});

// ==================== 历史完工数据统计（按实际完工时间，默认新旧合并）====================
router.get('/history-finish-stat', authRequired, adminOnly, (req, res) => {
  const where = [`deleted=0`, `actual_finish_time IS NOT NULL`, `actual_finish_time != ''`];
  const params = [];
  const projectType = parseProjectTypeFilter(req.query.project_type);
  if (projectType) where.push(projectTypeWhere('', projectType));
  if (req.query.start_date) { where.push(`date(actual_finish_time) >= date(?)`); params.push(req.query.start_date); }
  if (req.query.end_date) { where.push(`date(actual_finish_time) <= date(?)`); params.push(req.query.end_date); }

  const rows = db.prepare(`SELECT * FROM projects WHERE ${where.join(' AND ')} ORDER BY actual_finish_time DESC`).all(...params);
  const byMonth = {};
  const byType = {};
  let totalIncome = 0;
  let totalProfit = 0;
  for (const p of rows) {
    const ym = String(p.actual_finish_time).slice(0, 7);
    const { income, profit } = computeProfit(p);
    totalIncome += income;
    totalProfit += profit;
    byMonth[ym] = byMonth[ym] || { name: ym, count: 0, income: 0, profit: 0 };
    byMonth[ym].count++;
    byMonth[ym].income = round2(byMonth[ym].income + income);
    byMonth[ym].profit = round2(byMonth[ym].profit + profit);

    const label = projectTypeLabel(p.project_type);
    byType[label] = (byType[label] || 0) + 1;
  }

  return ok(res, {
    summary: {
      count: rows.length,
      totalIncome: round2(totalIncome),
      totalProfit: round2(totalProfit)
    },
    monthTrend: Object.keys(byMonth).sort().map((k) => byMonth[k]),
    typeDist: Object.entries(byType).map(([name, value]) => ({ name, value })),
    list: rows.map((p) => {
      const { income, profit } = computeProfit(p);
      return {
        id: p.id,
        name: p.name,
        project_type: p.project_type,
        project_type_label: projectTypeLabel(p.project_type),
        customer_name: p.customer_name,
        customer_phone: p.customer_phone,
        actual_finish_time: p.actual_finish_time,
        income,
        profit,
        settled: p.settled
      };
    })
  });
});

// ==================== 技术员个人汇总 ====================
router.get('/tech-summary', authRequired, (req, res) => {
  if (req.user.role !== 'tech') return fail(res, '仅技术员可查看个人汇总', 403);
  const rows = db.prepare(
    `SELECT * FROM projects
     WHERE deleted=0 AND ${projectTypeWhere('', PROJECT_TYPE.NORMAL)} AND tech_id=?
     ORDER BY id DESC`
  ).all(req.user.id);

  let totalIncome = 0;
  let totalTechFee = 0;
  let unpaidTechFee = 0;
  let completed = 0;
  let paymentRequested = 0;

  const list = rows.map((p) => {
    const { income } = computeProfit(p);
    const techFee = Number(p.tech_fee) || 0;
    totalIncome += income;
    totalTechFee += techFee;
    if (!p.settled) unpaidTechFee += techFee;
    if (p.status === 'completed') completed++;
    if (p.payment_requested && !p.settled) paymentRequested++;
    return {
      id: p.id,
      name: p.name,
      customer_name: p.customer_name,
      status: p.status,
      status_label: STATUS_LABEL[p.status] || p.status,
      progress: progressPercent(p.status),
      income: round2(income),
      tech_fee: round2(techFee),
      unpaid_tech_fee: p.settled ? 0 : round2(techFee),
      payment_requested: p.payment_requested,
      source_uploaded: p.source_uploaded,
      settled: p.settled,
      start_time: p.start_time,
      actual_finish_time: p.actual_finish_time
    };
  });

  return ok(res, {
    summary: {
      totalOrders: rows.length,
      completed,
      inProgress: rows.filter((p) => !['pending', 'completed'].includes(p.status)).length,
      paymentRequested,
      totalIncome: round2(totalIncome),
      totalTechFee: round2(totalTechFee),
      unpaidTechFee: round2(unpaidTechFee),
      completeRate: rows.length ? round2((completed / rows.length) * 100) : 0
    },
    list
  });
});

function progressPercent(status) {
  const flow = ['pending', 'stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'completed'];
  const idx = flow.indexOf(status);
  if (idx <= 0) return 0;
  return Math.round((idx / (flow.length - 1)) * 100);
}

// ==================== 简易统计：技术员下拉、项目下拉 ====================
router.get('/options/techs', authRequired, (req, res) => {
  const list = db.prepare(`SELECT id, name, username FROM users WHERE role='tech' AND deleted=0 AND status=1 ORDER BY id`).all();
  return ok(res, list);
});

router.get('/options/projects', authRequired, adminOnly, (req, res) => {
  const where = ['deleted=0'];
  const projectType = parseProjectTypeFilter(req.query.project_type);
  if (projectType) where.push(projectTypeWhere('', projectType));
  const list = db.prepare(`SELECT id, name, project_type FROM projects WHERE ${where.join(' AND ')} ORDER BY id DESC`).all();
  list.forEach((p) => { p.project_type_label = projectTypeLabel(p.project_type); });
  return ok(res, list);
});

module.exports = router;
