/**
 * 资金台账模块（仅管理员）
 * 所有收支流水，新旧项目全部入账，支持筛选、导出
 */
const express = require('express');
const ExcelJS = require('exceljs');
const db = require('../db');
const { ok, fail } = require('../utils/resp');
const { authRequired, adminOnly } = require('../middleware/auth');
const { writeLog } = require('../utils/logger');
const { parseProjectTypeFilter, projectTypeLabel, projectTypeWhere } = require('../utils/projectType');

const router = express.Router();
router.use(authRequired, adminOnly);

const TYPE_LABEL = { first: '首付款', mid: '中期款', final: '尾款', maintenance: '维护款', cost: '成本支出', techfee: '技术费用', other: '其他' };

function buildLedgerQuery(q) {
  const where = ['l.deleted=0', '(l.project_id IS NULL OR p.deleted=0)'];
  const params = [];
  if (q.project_id) { where.push('l.project_id=?'); params.push(Number(q.project_id)); }
  const projectType = parseProjectTypeFilter(q.project_type);
  if (projectType) where.push(projectTypeWhere('p', projectType));
  if (q.type) { where.push('l.type=?'); params.push(q.type); }
  if (q.direction) { where.push('l.direction=?'); params.push(q.direction); }
  if (q.start_date) { where.push('date(l.received_at) >= date(?)'); params.push(q.start_date); }
  if (q.end_date) { where.push('date(l.received_at) <= date(?)'); params.push(q.end_date); }
  if (q.year) { where.push(`strftime('%Y', l.received_at)=?`); params.push(String(q.year).slice(0, 4)); }
  if (q.month) { where.push(`strftime('%Y-%m', l.received_at)=?`); params.push(String(q.month).slice(0, 7)); }
  if (q.keyword) { where.push('(p.name LIKE ? OR l.custom_name LIKE ? OR l.remark LIKE ?)'); params.push(`%${q.keyword}%`, `%${q.keyword}%`, `%${q.keyword}%`); }
  return { whereSql: where.join(' AND '), params };
}

// 列表
router.get('/', (req, res) => {
  const q = req.query;
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(q.pageSize) || 10));
  const { whereSql, params } = buildLedgerQuery(q);

  const total = db.prepare(
    `SELECT COUNT(*) c FROM ledger l LEFT JOIN projects p ON p.id=l.project_id WHERE ${whereSql}`
  ).get(...params).c;
  const rows = db.prepare(
    `SELECT l.*, COALESCE(p.name, l.custom_name) project_name, p.project_type, u.name operator_name
     FROM ledger l LEFT JOIN projects p ON p.id=l.project_id LEFT JOIN users u ON u.id=l.operator_id
     WHERE ${whereSql} ORDER BY l.id DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, (page - 1) * pageSize);
  rows.forEach((r) => { r.type_label = TYPE_LABEL[r.type] || r.type; });
  rows.forEach((r) => { r.project_type_label = r.project_type ? projectTypeLabel(r.project_type) : '自定义'; });

  // 汇总
  const sum = db.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN l.direction='in' THEN l.amount ELSE 0 END),0) total_in,
       COALESCE(SUM(CASE WHEN l.direction='out' THEN l.amount ELSE 0 END),0) total_out
     FROM ledger l LEFT JOIN projects p ON p.id=l.project_id WHERE ${whereSql}`
  ).get(...params);
  const groupExpr = q.summary_period === 'year' ? "strftime('%Y', l.received_at)" : "strftime('%Y-%m', l.received_at)";
  const periodSummary = db.prepare(
    `SELECT ${groupExpr} period,
       COALESCE(SUM(CASE WHEN l.direction='in' THEN l.amount ELSE 0 END),0) total_in,
       COALESCE(SUM(CASE WHEN l.direction='out' THEN l.amount ELSE 0 END),0) total_out
     FROM ledger l LEFT JOIN projects p ON p.id=l.project_id
     WHERE ${whereSql} AND l.received_at IS NOT NULL AND l.received_at != ''
     GROUP BY period ORDER BY period DESC`
  ).all(...params).map((r) => ({ ...r, balance: Number(r.total_in || 0) - Number(r.total_out || 0) }));

  return ok(res, { list: rows, total, page, pageSize, summary: sum, periodSummary });
});

// 新增流水
router.post('/', (req, res) => {
  const { project_id, custom_name, type, amount, direction = 'in', received_at, remark } = req.body || {};
  if (!type || amount === undefined) return fail(res, '类型、金额为必填');
  let p = null;
  let pid = null;
  const name = String(custom_name || '').trim();
  if (project_id) {
    pid = Number(project_id);
    p = db.prepare(`SELECT * FROM projects WHERE id=? AND deleted=0`).get(pid);
    if (!p) return fail(res, '项目不存在', 404);
  } else if (!name) {
    return fail(res, '自定义流水请填写名称');
  }
  const info = db.prepare(
    `INSERT INTO ledger (project_id, custom_name, type, amount, direction, received_at, operator_id, remark) VALUES (?,?,?,?,?,?,?,?)`
  ).run(pid, p ? '' : name, type, Number(amount) || 0, direction === 'out' ? 'out' : 'in', received_at || null, req.user.id, remark || null);
  writeLog({ user: req.user, action: 'add_ledger', targetType: 'ledger', targetId: info.lastInsertRowid, detail: `新增流水 ${TYPE_LABEL[type] || type} ${amount} 元（${p ? '项目：' + p.name : '自定义：' + name}）` });
  return ok(res, { id: info.lastInsertRowid }, '新增成功');
});

// 删除流水
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`SELECT * FROM ledger WHERE id=? AND deleted=0`).get(id);
  if (!row) return fail(res, '流水不存在', 404);
  db.prepare(`UPDATE ledger SET deleted=1 WHERE id=?`).run(id);
  writeLog({ user: req.user, action: 'delete_ledger', targetType: 'ledger', targetId: id, detail: `删除流水 #${id}` });
  return ok(res, null, '删除成功');
});

// 导出
router.get('/export/excel', async (req, res) => {
  const { whereSql, params } = buildLedgerQuery(req.query);
  const rows = db.prepare(
    `SELECT l.*, COALESCE(p.name, l.custom_name) project_name, p.project_type, u.name operator_name
     FROM ledger l LEFT JOIN projects p ON p.id=l.project_id LEFT JOIN users u ON u.id=l.operator_id
     WHERE ${whereSql} ORDER BY l.id DESC`
  ).all(...params);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('资金台账');
  ws.columns = [
    { header: 'ID', key: 'id', width: 6 },
    { header: '项目名称', key: 'project_name', width: 22 },
    { header: '项目类型', key: 'project_type_label', width: 18 },
    { header: '款项类型', key: 'type_label', width: 12 },
    { header: '方向', key: 'direction', width: 8 },
    { header: '金额', key: 'amount', width: 12 },
    { header: '收付款时间', key: 'received_at', width: 16 },
    { header: '操作人', key: 'operator_name', width: 10 },
    { header: '备注', key: 'remark', width: 24 }
  ];
  rows.forEach((r) => ws.addRow({ ...r, type_label: TYPE_LABEL[r.type] || r.type, project_type_label: r.project_type ? projectTypeLabel(r.project_type) : '自定义', direction: r.direction === 'in' ? '收入' : '支出' }));
  ws.getRow(1).font = { bold: true };
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=ledger_${Date.now()}.xlsx`);
  await wb.xlsx.write(res);
  res.end();
});

module.exports = router;
