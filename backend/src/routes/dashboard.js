/**
 * 数据可视化大屏 - 全量统计（常规 + 旧完结维护项目 100% 并入）
 */
const express = require('express');
const db = require('../db');
const { ok } = require('../utils/resp');
const { authRequired, adminOnly } = require('../middleware/auth');
const { computeProfit, round2 } = require('../utils/profit');
const {
  parseProjectTypeFilter,
  isHistoryProject,
  isNormalProject,
  projectTypeWhere
} = require('../utils/projectType');

const router = express.Router();
router.use(authRequired, adminOnly);

router.get('/', (req, res) => {
  const where = ['deleted=0'];
  const projectType = parseProjectTypeFilter(req.query.project_type);
  if (projectType) where.push(projectTypeWhere('', projectType));
  const whereSql = where.join(' AND ');
  const projects = db.prepare(`SELECT * FROM projects WHERE ${whereSql}`).all();

  // ---- 核心指标 ----
  let totalIncome = 0, totalCost = 0, totalProfit = 0, pendingSettle = 0;
  let inProgress = 0, completed = 0, pending = 0;
  let normalCount = 0, maintenanceCount = 0;
  let normalAmount = 0, maintenanceAmount = 0;
  const statusDist = {};
  const techStat = {}; // 启用技术员承接数量，0 项目也展示
  const techs = db.prepare(`SELECT id, name FROM users WHERE role='tech' AND deleted=0 AND status=1 ORDER BY id`).all();
  for (const t of techs) techStat[t.id] = { name: t.name, value: 0 };

  for (const p of projects) {
    const { income, profit } = computeProfit(p);
    totalIncome += income;
    totalCost += (Number(p.project_cost) || 0) + (Number(p.tech_fee) || 0);
    totalProfit += profit;

    // 待结算：已完工但未结算的尾款差额（总酬劳 - 已收）
    if (!p.settled) {
      const unpaid = (Number(p.total_reward) || 0) - income;
      if (unpaid > 0) pendingSettle += unpaid;
    }

    statusDist[p.status] = (statusDist[p.status] || 0) + 1;
    if (p.status === 'completed') completed++;
    else if (p.status === 'pending') pending++;
    else inProgress++;

    if (isHistoryProject(p)) { maintenanceCount++; maintenanceAmount += income; }
    else { normalCount++; normalAmount += income; }

    if (isNormalProject(p) && p.tech_id) {
      if (!techStat[p.tech_id]) {
        const t = db.prepare(`SELECT name FROM users WHERE id=? AND role='tech' AND deleted=0 AND status=1`).get(p.tech_id);
        if (!t) continue;
        techStat[p.tech_id] = { name: t.name, value: 0 };
      }
      techStat[p.tech_id].value++;
    }
  }

  // ---- 月度营收/利润（基于台账收款时间 + 项目）----
  const ledgerRows = db.prepare(
    `SELECT l.type, l.amount, l.direction, l.received_at
     FROM ledger l JOIN projects p ON p.id=l.project_id
     WHERE l.deleted=0 AND p.deleted=0${projectType ? ` AND ${projectTypeWhere('p', projectType)}` : ''}`
  ).all();
  const monthRevenue = {}; // { '2026-06': income }
  for (const r of ledgerRows) {
    if (!r.received_at) continue;
    const ym = String(r.received_at).slice(0, 7);
    if (r.direction === 'in') monthRevenue[ym] = (monthRevenue[ym] || 0) + (Number(r.amount) || 0);
  }

  // 月度利润 & 完工趋势（基于 actual_finish_time）
  const monthProfit = {};
  const finishTrend = {}; // 完工数量趋势
  for (const p of projects) {
    const { profit } = computeProfit(p);
    if (p.actual_finish_time) {
      const ym = String(p.actual_finish_time).slice(0, 7);
      monthProfit[ym] = (monthProfit[ym] || 0) + profit;
      finishTrend[ym] = (finishTrend[ym] || 0) + 1;
    }
  }

  // ---- 服务器统计 ----
  const serverPush = { 是: 0, 否: 0 };
  const serverOwner = { 个人: 0, 公司: 0 };
  for (const p of projects) {
    if (p.server_first_push === '是') serverPush['是']++;
    else if (p.server_first_push === '否') serverPush['否']++;
    if (p.server_owner === '个人') serverOwner['个人']++;
    else if (p.server_owner === '公司') serverOwner['公司']++;
  }

  const statusLabel = { pending: '待接单', stage1: '接单', stage2: '初版展示', stage3: '终版修改', stage4: '完成源码上传', stage5: '提交付款申请', completed: '已完工' };

  return ok(res, {
    cards: {
      totalProjects: projects.length,
      normalProjects: normalCount,
      historyProjects: maintenanceCount,
      inProgress,
      completed,
      pending,
      totalIncome: round2(totalIncome),
      totalCost: round2(totalCost),
      totalProfit: round2(totalProfit),
      pendingSettle: round2(pendingSettle)
    },
    // 项目状态占比
    statusDist: Object.entries(statusDist).map(([k, v]) => ({ name: statusLabel[k] || k, value: v })),
    // 新旧项目占比
    typeDist: [
      { name: '常规开发项目', value: normalCount },
      { name: '纯维护/旧完结项目', value: maintenanceCount }
    ],
    // 项目类型看板（数量+金额对比）
    typeBoard: {
      normal: { count: normalCount, amount: round2(normalAmount) },
      maintenance: { count: maintenanceCount, amount: round2(maintenanceAmount) }
    },
    // 月度营收
    monthRevenue: sortedSeries(monthRevenue),
    // 月度利润
    monthProfit: sortedSeries(monthProfit),
    // 各技术员承接项目数
    techStat: Object.values(techStat),
    // 完工时间趋势（含历史旧项目）
    finishTrend: sortedSeries(finishTrend),
    // 资金收支环形图
    fundRing: [
      { name: '总收入', value: round2(totalIncome) },
      { name: '总成本', value: round2(totalCost) },
      { name: '总利润', value: round2(totalProfit) }
    ],
    // 服务器统计
    serverPush: Object.entries(serverPush).map(([k, v]) => ({ name: `首推:${k}`, value: v })),
    serverOwner: Object.entries(serverOwner).map(([k, v]) => ({ name: k, value: v }))
  });
});

function sortedSeries(obj) {
  return Object.keys(obj).sort().map((k) => ({ name: k, value: round2(obj[k]) }));
}

module.exports = router;
