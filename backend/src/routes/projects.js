/**
 * 项目管理核心路由
 * - 管理员：创建/编辑/删除/分配/筛选/导出，支持常规项目与纯维护旧项目
 * - 技术员：仅查看分配给自己的常规项目、进度流转、付款申请
 */
const express = require('express');
const ExcelJS = require('exceljs');
const db = require('../db');
const { ok, fail } = require('../utils/resp');
const { authRequired, adminOnly } = require('../middleware/auth');
const { writeLog } = require('../utils/logger');
const { computeProfit, round2 } = require('../utils/profit');
const {
  PROJECT_TYPE,
  normalizeProjectType,
  parseProjectTypeFilter,
  isHistoryProject,
  projectTypeLabel,
  projectTypeWhere
} = require('../utils/projectType');

const router = express.Router();

// 常规项目进度流转顺序
const NORMAL_FLOW = ['pending', 'stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'completed'];
const STAGE_LABEL = {
  pending: '待接单', stage1: '接单', stage2: '初版展示', stage3: '终版修改',
  stage4: '完成源码上传', stage5: '提交付款申请', completed: '已完工'
};

// 项目录入允许的字段白名单
const EDITABLE_FIELDS = [
  'project_type', 'name', 'description', 'requirement', 'duration', 'customer_name', 'customer_phone',
  'group_name',
  'tech_id', 'status', 'start_time', 'total_reward', 'first_payment', 'mid_payment', 'final_payment',
  'project_cost', 'tech_fee', 'server_first_push', 'server_owner', 'server_location', 'server_start_date',
  'server_buy_date', 'server_expire_date', 'maintenance_amount', 'maintenance_expire_date',
  'source_uploaded', 'remark', 'actual_finish_time', 'settled'
];

// 给项目对象附加计算字段（利润、收入、状态标签、技术员姓名、标签）
function enrich(p) {
  if (!p) return p;
  const { income, profit } = computeProfit(p);
  p.income = income;
  p.profit = profit;
  p.status_label = STAGE_LABEL[p.status] || p.status;
  p.project_type = normalizeProjectType(p.project_type);
  p.type_label = projectTypeLabel(p.project_type);
  const tech = p.tech_id ? db.prepare(`SELECT name FROM users WHERE id=?`).get(p.tech_id) : null;
  p.tech_name = tech ? tech.name : '';
  p.tags = db.prepare(
    `SELECT t.id, t.name, t.color FROM tags t JOIN project_tags pt ON pt.tag_id=t.id WHERE pt.project_id=? AND t.deleted=0`
  ).all(p.id);
  return p;
}

// 构建列表查询（管理员用，含全部筛选条件）
function buildQuery(q) {
  const where = ['p.deleted=0'];
  const params = [];

  // 全局模糊搜索
  if (q.keyword) {
    where.push(`(p.name LIKE ? OR p.group_name LIKE ? OR p.customer_name LIKE ? OR p.customer_phone LIKE ? OR p.description LIKE ? OR p.remark LIKE ? OR p.server_location LIKE ? OR u.name LIKE ?)`);
    const kw = `%${q.keyword}%`;
    params.push(kw, kw, kw, kw, kw, kw, kw, kw);
  }
  const projectType = parseProjectTypeFilter(q.project_type);
  if (projectType) where.push(projectTypeWhere('p', projectType));
  if (q.status) { where.push(`p.status=?`); params.push(q.status); }
  if (q.status_group === 'in_progress') where.push(`p.status IN ('stage1','stage2','stage3','stage4','stage5')`);
  if (q.tech_id) { where.push(`p.tech_id=?`); params.push(Number(q.tech_id)); }
  if (q.settled !== undefined && q.settled !== '') { where.push(`p.settled=?`); params.push(Number(q.settled)); }
  if (q.server_first_push) { where.push(`p.server_first_push=?`); params.push(q.server_first_push); }
  if (q.server_owner) { where.push(`p.server_owner=?`); params.push(q.server_owner); }
  if (q.tag_id) {
    where.push(`p.id IN (SELECT project_id FROM project_tags WHERE tag_id=?)`);
    params.push(Number(q.tag_id));
  }
  // 创建时间段
  if (q.start_date) { where.push(`date(p.created_at) >= date(?)`); params.push(q.start_date); }
  if (q.end_date) { where.push(`date(p.created_at) <= date(?)`); params.push(q.end_date); }
  // 完工时间区间
  if (q.finish_start) { where.push(`date(p.actual_finish_time) >= date(?)`); params.push(q.finish_start); }
  if (q.finish_end) { where.push(`date(p.actual_finish_time) <= date(?)`); params.push(q.finish_end); }

  return { whereSql: where.join(' AND '), params };
}

// ---------------- 列表（管理员：全部；技术员：仅自己的常规项目）----------------
router.get('/', authRequired, (req, res) => {
  const q = req.query;
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(q.pageSize) || 10));

  if (req.user.role === 'tech') {
    // 技术员：只能看分配给自己的常规项目，永远看不到维护/旧项目
    const where = `p.deleted=0 AND ${projectTypeWhere('p', PROJECT_TYPE.NORMAL)} AND p.tech_id=?`;
    const params = [req.user.id];
    const total = db.prepare(`SELECT COUNT(*) c FROM projects p WHERE ${where}`).get(...params).c;
    const rows = db.prepare(
      `SELECT p.* FROM projects p WHERE ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`
    ).all(...params, pageSize, (page - 1) * pageSize);
    return ok(res, { list: rows.map(enrich), total, page, pageSize });
  }

  // 管理员
  const { whereSql, params } = buildQuery(q);
  const total = db.prepare(
    `SELECT COUNT(*) c FROM projects p LEFT JOIN users u ON u.id=p.tech_id WHERE ${whereSql}`
  ).get(...params).c;
  const rows = db.prepare(
    `SELECT p.* FROM projects p LEFT JOIN users u ON u.id=p.tech_id WHERE ${whereSql} ORDER BY p.id DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, (page - 1) * pageSize);
  return ok(res, { list: rows.map(enrich), total, page, pageSize });
});

// ---------------- 详情 ----------------
router.get('/:id', authRequired, (req, res) => {
  const id = Number(req.params.id);
  const p = db.prepare(`SELECT * FROM projects WHERE id=? AND deleted=0`).get(id);
  if (!p) return fail(res, '项目不存在', 404);
  // 技术员权限：只能看分配给自己的常规项目
  if (req.user.role === 'tech' && (isHistoryProject(p) || p.tech_id !== req.user.id)) {
    return fail(res, '无权访问该项目', 403);
  }
  enrich(p);
  // 附件
  p.files = db.prepare(`SELECT * FROM project_files WHERE project_id=? AND deleted=0 ORDER BY id`).all(id);
  // 进度记录
  p.progress = db.prepare(
    `SELECT pl.*, u.name operator_name FROM progress_logs pl LEFT JOIN users u ON u.id=pl.operator_id WHERE pl.project_id=? ORDER BY pl.id`
  ).all(id);
  return ok(res, p);
});

// ---------------- 创建项目（仅管理员）----------------
router.post('/', authRequired, adminOnly, (req, res) => {
  const b = req.body || {};
  // 必填校验
  const required = { name: '项目名称', description: '项目描述', requirement: '项目要求', duration: '项目工期' };
  for (const [k, label] of Object.entries(required)) {
    if (!b[k] || String(b[k]).trim() === '') return fail(res, `${label}不能为空`);
  }
  const projectType = normalizeProjectType(b.project_type);

  // 维护项目：强制无技术员、状态固定 completed；常规项目：默认 pending
  let techId = null;
  let status = 'pending';
  if (projectType === PROJECT_TYPE.HISTORY) {
    techId = null;
    status = 'completed';
  } else {
    techId = b.tech_id ? Number(b.tech_id) : null;
    status = b.status && NORMAL_FLOW.includes(b.status) ? b.status : 'pending';
  }

  const row = {};
  for (const f of EDITABLE_FIELDS) row[f] = b[f] !== undefined ? b[f] : null;
  row.project_type = projectType;
  row.tech_id = techId;

  const info = db.prepare(`
    INSERT INTO projects (
      project_type, name, description, requirement, duration, customer_name, customer_phone,
      group_name, tech_id, status, start_time, total_reward, first_payment, mid_payment, final_payment,
      project_cost, tech_fee, server_first_push, server_owner, server_location, server_start_date,
      server_buy_date, server_expire_date, maintenance_amount, maintenance_expire_date,
      source_uploaded, remark, actual_finish_time, settled, created_by
    ) VALUES (
      @project_type,@name,@description,@requirement,@duration,@customer_name,@customer_phone,
      @group_name,@tech_id,@status,@start_time,@total_reward,@first_payment,@mid_payment,@final_payment,
      @project_cost,@tech_fee,@server_first_push,@server_owner,@server_location,@server_start_date,
      @server_buy_date,@server_expire_date,@maintenance_amount,@maintenance_expire_date,
      @source_uploaded,@remark,@actual_finish_time,@settled,@created_by)
  `).run({
    project_type: projectType,
    name: b.name, description: b.description, requirement: b.requirement, duration: b.duration,
    customer_name: b.customer_name || '', customer_phone: b.customer_phone || '', group_name: b.group_name || '',
    tech_id: techId, status,
    start_time: b.start_time || null,
    total_reward: num(b.total_reward), first_payment: num(b.first_payment), mid_payment: num(b.mid_payment),
    final_payment: num(b.final_payment), project_cost: num(b.project_cost), tech_fee: num(b.tech_fee),
    server_first_push: b.server_first_push || null, server_owner: b.server_owner || null, server_location: b.server_location || null,
    server_start_date: b.server_start_date || null, server_buy_date: b.server_buy_date || null,
    server_expire_date: b.server_expire_date || null, maintenance_amount: num(b.maintenance_amount),
    maintenance_expire_date: b.maintenance_expire_date || null,
    source_uploaded: normalizeOptionalBool(b.source_uploaded),
    remark: b.remark || null, actual_finish_time: b.actual_finish_time || null,
    settled: b.settled ? 1 : 0, created_by: req.user.id
  });

  const pid = info.lastInsertRowid;
  // 标签
  if (Array.isArray(b.tag_ids)) setProjectTags(pid, b.tag_ids);
  // 自动生成资金台账（首/中/尾款有值即入账）
  autoLedger(pid, b, req.user.id);

  writeLog({ user: req.user, action: 'create_project', targetType: 'project', targetId: pid, detail: `创建${projectType === PROJECT_TYPE.HISTORY ? '历史维护完结' : '常规'}项目：${b.name}` });
  return ok(res, { id: pid }, '创建成功');
});

// ---------------- 编辑项目（仅管理员）----------------
router.put('/:id', authRequired, adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const p = db.prepare(`SELECT * FROM projects WHERE id=? AND deleted=0`).get(id);
  if (!p) return fail(res, '项目不存在', 404);
  const b = req.body || {};

  // 必填校验（若传了则不能为空）
  const required = { name: '项目名称', description: '项目描述', requirement: '项目要求', duration: '项目工期' };
  for (const [k, label] of Object.entries(required)) {
    if (b[k] !== undefined && String(b[k]).trim() === '') return fail(res, `${label}不能为空`);
  }

  const fields = [];
  const params = [];
  const numFields = ['total_reward', 'first_payment', 'mid_payment', 'final_payment', 'project_cost', 'tech_fee', 'maintenance_amount'];
  for (const f of EDITABLE_FIELDS) {
    if (b[f] === undefined) continue;
    if (f === 'project_type') {
      // 类型切换：维护项目强制清空技术员并置完结
      const t = normalizeProjectType(b[f]);
      fields.push('project_type=?'); params.push(t);
      if (t === PROJECT_TYPE.HISTORY) {
        fields.push('tech_id=?'); params.push(null);
        fields.push('status=?'); params.push('completed');
      }
      continue;
    }
    if (f === 'tech_id') {
      // 若当前/目标为维护项目，忽略 tech_id
      const targetType = normalizeProjectType(b.project_type, normalizeProjectType(p.project_type));
      if (targetType === PROJECT_TYPE.HISTORY) continue;
      fields.push('tech_id=?'); params.push(b.tech_id ? Number(b.tech_id) : null);
      continue;
    }
    if (f === 'status') {
      const targetType = normalizeProjectType(b.project_type, normalizeProjectType(p.project_type));
      if (targetType === PROJECT_TYPE.HISTORY) continue;
      if (!NORMAL_FLOW.includes(b.status)) return fail(res, '非法的项目状态');
      fields.push('status=?'); params.push(b.status);
      if (b.status === 'completed' && !b.actual_finish_time && !p.actual_finish_time) {
        fields.push(`actual_finish_time=date('now','localtime')`);
      }
      continue;
    }
    if (f === 'actual_finish_time' && !b[f] && b.status === 'completed' && !p.actual_finish_time) {
      continue;
    }
    fields.push(`${f}=?`);
    params.push(numFields.includes(f)
      ? num(b[f])
      : (['settled', 'source_uploaded'].includes(f)
          ? normalizeOptionalBool(b[f])
          : (['customer_name', 'customer_phone', 'group_name'].includes(f) ? (b[f] || '') : (b[f] || null))));
  }
  if (fields.length) {
    fields.push(`updated_at=datetime('now','localtime')`);
    params.push(id);
    db.prepare(`UPDATE projects SET ${fields.join(',')} WHERE id=?`).run(...params);
  }
  // 标签更新
  if (Array.isArray(b.tag_ids)) setProjectTags(id, b.tag_ids);

  writeLog({ user: req.user, action: 'update_project', targetType: 'project', targetId: id, detail: `编辑项目：${p.name}` });
  return ok(res, null, '更新成功');
});

// ---------------- 分配技术员（仅管理员，仅常规项目）----------------
router.patch('/:id/assign', authRequired, adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const { tech_id } = req.body || {};
  const p = db.prepare(`SELECT * FROM projects WHERE id=? AND deleted=0`).get(id);
  if (!p) return fail(res, '项目不存在', 404);
  if (isHistoryProject(p)) return fail(res, '历史维护完结项目不支持分配技术员');
  const tech = db.prepare(`SELECT * FROM users WHERE id=? AND role='tech' AND deleted=0`).get(Number(tech_id));
  if (!tech) return fail(res, '技术员不存在');
  db.prepare(`UPDATE projects SET tech_id=?, updated_at=datetime('now','localtime') WHERE id=?`).run(tech.id, id);
  writeLog({ user: req.user, action: 'assign_project', targetType: 'project', targetId: id, detail: `分配给技术员：${tech.name}` });
  return ok(res, null, '分配成功');
});

// ---------------- 进度流转（技术员/管理员，常规项目按顺序）----------------
router.patch('/:id/progress', authRequired, (req, res) => {
  const id = Number(req.params.id);
  const { to_status, note, source_uploaded } = req.body || {};
  const p = db.prepare(`SELECT * FROM projects WHERE id=? AND deleted=0`).get(id);
  if (!p) return fail(res, '项目不存在', 404);
  if (isHistoryProject(p)) return fail(res, '历史维护完结项目无需进度流转');
  // 技术员仅能操作自己的项目
  if (req.user.role === 'tech' && p.tech_id !== req.user.id) return fail(res, '无权操作该项目', 403);
  if (p.locked) return fail(res, '项目已提交付款申请并锁定，无法继续流转');

  const curIdx = NORMAL_FLOW.indexOf(p.status);
  const nextIdx = NORMAL_FLOW.indexOf(to_status);
  if (nextIdx === -1) return fail(res, '非法的目标状态');
  // 必须按顺序前进（只能 +1）
  if (nextIdx !== curIdx + 1) return fail(res, `进度只能按顺序流转，当前为「${STAGE_LABEL[p.status]}」`);

  // 到 stage5（提交付款申请）需勾选源码是否上传
  let extra = '';
  const tx = db.transaction(() => {
    if (to_status === 'stage5') {
      if (source_uploaded === undefined || source_uploaded === null) {
        throw new Error('提交付款申请必须勾选「源码是否上传」');
      }
      db.prepare(
        `UPDATE projects SET status=?, payment_requested=1, source_uploaded=?, payment_request_time=datetime('now','localtime'), locked=1, updated_at=datetime('now','localtime') WHERE id=?`
      ).run(to_status, source_uploaded ? 1 : 0, id);
      extra = `，源码是否上传：${source_uploaded ? '是' : '否'}`;
    } else {
      db.prepare(`UPDATE projects SET status=?, updated_at=datetime('now','localtime') WHERE id=?`).run(to_status, id);
    }
    db.prepare(
      `INSERT INTO progress_logs (project_id, from_status, to_status, note, operator_id) VALUES (?,?,?,?,?)`
    ).run(id, p.status, to_status, note || null, req.user.id);
  });
  try {
    tx();
  } catch (e) {
    return fail(res, e.message);
  }

  writeLog({ user: req.user, action: to_status === 'stage5' ? 'payment_request' : 'progress', targetType: 'project', targetId: id, detail: `进度流转：${STAGE_LABEL[p.status]} → ${STAGE_LABEL[to_status]}${extra}${note ? '，备注：' + note : ''}` });
  return ok(res, null, '流转成功');
});

// ---------------- 软删除项目（仅管理员）----------------
router.delete('/:id', authRequired, adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const p = db.prepare(`SELECT * FROM projects WHERE id=? AND deleted=0`).get(id);
  if (!p) return fail(res, '项目不存在', 404);
  db.prepare(`UPDATE projects SET deleted=1, updated_at=datetime('now','localtime') WHERE id=?`).run(id);
  writeLog({ user: req.user, action: 'delete_project', targetType: 'project', targetId: id, detail: `删除项目：${p.name}` });
  return ok(res, null, '删除成功');
});

// ---------------- 批量软删除（仅管理员）----------------
router.post('/batch-delete', authRequired, adminOnly, (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return fail(res, '请选择要删除的项目');
  const tx = db.transaction((list) => {
    for (const id of list) {
      db.prepare(`UPDATE projects SET deleted=1, updated_at=datetime('now','localtime') WHERE id=?`).run(Number(id));
    }
  });
  tx(ids);
  writeLog({ user: req.user, action: 'batch_delete_project', targetType: 'project', detail: `批量删除 ${ids.length} 个项目` });
  return ok(res, null, '批量删除成功');
});

// ---------------- 导出 Excel（仅管理员，复用筛选条件）----------------
router.get('/export/excel', authRequired, adminOnly, async (req, res) => {
  const { whereSql, params } = buildQuery(req.query);
  const rows = db.prepare(
    `SELECT p.* FROM projects p LEFT JOIN users u ON u.id=p.tech_id WHERE ${whereSql} ORDER BY p.id DESC`
  ).all(...params).map(enrich);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('项目列表');
  ws.columns = [
    { header: 'ID', key: 'id', width: 6 },
    { header: '项目类型', key: 'type_label', width: 18 },
    { header: '项目名称', key: 'name', width: 22 },
    { header: '客户姓名', key: 'customer_name', width: 12 },
    { header: '客户电话', key: 'customer_phone', width: 15 },
    { header: '群名', key: 'group_name', width: 18 },
    { header: '技术员', key: 'tech_name', width: 10 },
    { header: '状态', key: 'status_label', width: 12 },
    { header: '工期', key: 'duration', width: 10 },
    { header: '总酬劳', key: 'total_reward', width: 12 },
    { header: '首付款', key: 'first_payment', width: 12 },
    { header: '中期款', key: 'mid_payment', width: 12 },
    { header: '尾款', key: 'final_payment', width: 12 },
    { header: '成本', key: 'project_cost', width: 10 },
    { header: '技术费用', key: 'tech_fee', width: 12 },
    { header: '收入', key: 'income', width: 12 },
    { header: '利润', key: 'profit', width: 12 },
    { header: '维护金额', key: 'maintenance_amount', width: 12 },
    { header: '是否结算', key: 'settled', width: 10 },
    { header: '服务器首推', key: 'server_first_push', width: 12 },
    { header: '归属', key: 'server_owner', width: 10 },
    { header: '服务器位置', key: 'server_location', width: 16 },
    { header: '服务器到期', key: 'server_expire_date', width: 14 },
    { header: '维护费到期', key: 'maintenance_expire_date', width: 14 },
    { header: '源码是否提交', key: 'source_uploaded_label', width: 14 },
    { header: '实际完工时间', key: 'actual_finish_time', width: 16 },
    { header: '备注', key: 'remark', width: 24 },
    { header: '创建时间', key: 'created_at', width: 20 }
  ];
  rows.forEach((r) => ws.addRow({ ...r, settled: r.settled ? '已结算' : '未结算', source_uploaded_label: r.source_uploaded === null || r.source_uploaded === undefined ? '未填写' : (r.source_uploaded ? '是' : '否') }));
  ws.getRow(1).font = { bold: true };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=projects_${Date.now()}.xlsx`);
  await wb.xlsx.write(res);
  res.end();
});

// ---------------- 工具函数 ----------------
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeOptionalBool(v) {
  if (v === undefined || v === null || v === '') return null;
  return v === true || v === 1 || v === '1' || v === '是' ? 1 : 0;
}

function setProjectTags(projectId, tagIds) {
  db.prepare(`DELETE FROM project_tags WHERE project_id=?`).run(projectId);
  const ins = db.prepare(`INSERT OR IGNORE INTO project_tags (project_id, tag_id) VALUES (?,?)`);
  for (const t of tagIds) ins.run(projectId, Number(t));
}

// 创建项目时，根据首/中/尾款自动生成收入台账
function autoLedger(projectId, b, operatorId) {
  const ins = db.prepare(
    `INSERT INTO ledger (project_id, type, amount, direction, received_at, operator_id, remark) VALUES (?,?,?,?,?,?,?)`
  );
  const map = [
    ['first', num(b.first_payment)], ['mid', num(b.mid_payment)], ['final', num(b.final_payment)]
  ];
  for (const [type, amount] of map) {
    if (amount > 0) ins.run(projectId, type, amount, 'in', b.start_time || null, operatorId, '录入项目时自动入账');
  }
}

module.exports = router;
