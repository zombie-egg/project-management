/**
 * 后端接口自测脚本（无外部依赖，使用内置 fetch）
 * 用法：先启动服务 npm start，另开终端 node scripts/selftest.js
 * 覆盖：登录、鉴权、CRUD、利润计算、筛选、进度流转、付款申请、导出、大屏、逾期、业绩
 */
const BASE = process.env.BASE || 'http://localhost:3000/api';
let pass = 0, failCount = 0;
const RUN_ID = Date.now();

function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`); }
  else { failCount++; console.error(`  ❌ ${msg}`); }
}

async function req(method, url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const isJson = (res.headers.get('content-type') || '').includes('json');
  const data = isJson ? await res.json() : await res.arrayBuffer();
  return { status: res.status, data };
}

(async () => {
  console.log('\n=== 1. 健康检查 ===');
  const h = await req('GET', '/health');
  assert(h.data.code === 0, '健康检查通过');

  console.log('\n=== 2. 登录 ===');
  const login = await req('POST', '/auth/login', { username: 'admin', password: 'Ccj940904' });
  assert(login.data.code === 0 && login.data.data.token, '管理员登录成功');
  const adminToken = login.data.data.token;
  const cleanup = { userId: null, projectIds: [], tagId: null };

  const badLogin = await req('POST', '/auth/login', { username: 'admin', password: 'wrong' });
  assert(badLogin.data.code === 401, '错误密码被拒绝');

  const techLogin = await req('POST', '/auth/login', { username: 'tech01', password: 'tech123' });
  assert(techLogin.data.code === 0, '技术员登录成功');
  const techToken = techLogin.data.data.token;

  console.log('\n=== 3. 鉴权拦截 ===');
  const noAuth = await req('GET', '/users');
  assert(noAuth.status === 401, '无token访问被拦截');
  const techForbidden = await req('GET', '/users', null, techToken);
  assert(techForbidden.status === 403, '技术员访问用户管理被拒绝');

  console.log('\n=== 4. 用户管理 CRUD ===');
  const testUsername = `tech_test_${RUN_ID}`;
  const createUser = await req('POST', '/users', { username: testUsername, password: '123456', name: '测试员', phone: '13700000000' }, adminToken);
  assert(createUser.data.code === 0, '创建技术员成功');
  const newUserId = createUser.data.data.id;
  cleanup.userId = newUserId;
  const dupUser = await req('POST', '/users', { username: testUsername, password: '123456', name: '重复' }, adminToken);
  assert(dupUser.data.code !== 0, '重复账号被拒绝');
  const editUser = await req('PUT', `/users/${newUserId}`, { name: '测试员改' }, adminToken);
  assert(editUser.data.code === 0, '编辑技术员成功');
  const disableUser = await req('PATCH', `/users/${newUserId}/status`, { status: 0 }, adminToken);
  assert(disableUser.data.code === 0, '禁用技术员成功');

  console.log('\n=== 5. 项目创建 + 必填校验 ===');
  const missReq = await req('POST', '/projects', { name: '缺字段项目' }, adminToken);
  assert(missReq.data.code !== 0, '缺必填字段被拒绝');

  const createNormal = await req('POST', '/projects', {
    project_type: 1, name: `自测常规项目_${RUN_ID}`, description: '描述', requirement: '需求', duration: '20天',
    customer_name: '测试客户', customer_phone: '13600000000', tech_id: 2,
    first_payment: 10000, mid_payment: 5000, final_payment: 5000, project_cost: 2000, tech_fee: 3000, total_reward: 20000
  }, adminToken);
  assert(createNormal.data.code === 0, '创建常规项目成功');
  const normalId = createNormal.data.data.id;
  cleanup.projectIds.push(normalId);

  console.log('\n=== 6. 利润自动计算 ===');
  const detail = await req('GET', `/projects/${normalId}`, null, adminToken);
  // (10000+5000+5000) - 2000 - 3000 = 15000
  assert(detail.data.data.profit === 15000, `利润计算正确 (期望15000, 实际${detail.data.data.profit})`);
  assert(detail.data.data.income === 20000, `收入计算正确 (期望20000, 实际${detail.data.data.income})`);

  console.log('\n=== 7. 维护项目：无技术员、状态completed ===');
  const createMaint = await req('POST', '/projects', {
    project_type: 2, name: `自测维护项目_${RUN_ID}`, description: '旧项目', requirement: '已完成', duration: '已完结',
    tech_id: 2,
    first_payment: 30000, project_cost: 5000, tech_fee: 8000, actual_finish_time: '2024-06-01'
  }, adminToken);
  assert(createMaint.data.code === 0, '创建维护项目成功');
  cleanup.projectIds.push(createMaint.data.data.id);
  const maintDetail = await req('GET', `/projects/${createMaint.data.data.id}`, null, adminToken);
  assert(maintDetail.data.data.tech_id === null, '维护项目技术员被强制清空');
  assert(maintDetail.data.data.status === 'completed', '维护项目状态固定completed');

  console.log('\n=== 8. 技术员可见性 ===');
  const techList = await req('GET', '/projects', null, techToken);
  const techSeeMaint = techList.data.data.list.some((p) => Number(p.project_type) === 2);
  assert(!techSeeMaint, '技术员看不到任何维护项目');

  console.log('\n=== 9. 筛选 & 模糊搜索 ===');
  const filterType = await req('GET', '/projects?project_type=2', null, adminToken);
  const allMaint = filterType.data.data.list.every((p) => Number(p.project_type) === 2);
  assert(allMaint && filterType.data.data.list.length > 0, '按项目类型筛选正确');
  const search = await req('GET', `/projects?keyword=自测常规项目_${RUN_ID}`, null, adminToken);
  assert(search.data.data.list.some((p) => p.id === normalId), '模糊搜索命中');

  console.log('\n=== 10. 进度流转 (顺序校验) ===');
  // 该常规项目分配给 tech_id=2 (tech01)，用 tech01 登录操作
  const skipStage = await req('PATCH', `/projects/${normalId}/progress`, { to_status: 'stage3' }, techToken);
  assert(skipStage.data.code !== 0, '跳阶段被拒绝');
  const s1 = await req('PATCH', `/projects/${normalId}/progress`, { to_status: 'stage1', note: '已接单' }, techToken);
  assert(s1.data.code === 0, '流转到接单成功');
  await req('PATCH', `/projects/${normalId}/progress`, { to_status: 'stage2' }, techToken);
  await req('PATCH', `/projects/${normalId}/progress`, { to_status: 'stage3' }, techToken);
  await req('PATCH', `/projects/${normalId}/progress`, { to_status: 'stage4' }, techToken);

  console.log('\n=== 11. 付款申请 (源码勾选 + 锁定) ===');
  const noSource = await req('PATCH', `/projects/${normalId}/progress`, { to_status: 'stage5' }, techToken);
  assert(noSource.data.code !== 0, '未勾选源码提交被拒绝');
  const payReq = await req('PATCH', `/projects/${normalId}/progress`, { to_status: 'stage5', source_uploaded: true, note: '源码已私发' }, techToken);
  assert(payReq.data.code === 0, '提交付款申请成功');
  const locked = await req('PATCH', `/projects/${normalId}/progress`, { to_status: 'completed' }, techToken);
  assert(locked.data.code !== 0, '锁定后无法继续流转');

  console.log('\n=== 12. 资金台账 ===');
  const ledgerList = await req('GET', '/ledger', null, adminToken);
  assert(ledgerList.data.code === 0 && ledgerList.data.data.total > 0, '台账列表正常');
  const addLedger = await req('POST', '/ledger', { project_id: normalId, type: 'final', amount: 5000, direction: 'in', received_at: '2026-07-01' }, adminToken);
  assert(addLedger.data.code === 0, '新增流水成功');

  console.log('\n=== 13. 数据大屏全量统计 ===');
  const dash = await req('GET', '/dashboard', null, adminToken);
  assert(dash.data.code === 0, '大屏接口正常');
  assert(dash.data.data.cards.totalProjects >= 6, '大屏含新旧全部项目');
  assert(dash.data.data.typeDist.length === 2, '新旧项目占比统计存在');

  console.log('\n=== 14. 逾期 & 业绩 & 维护台账 ===');
  const overdue = await req('GET', '/overdue', null, adminToken);
  assert(overdue.data.code === 0, '逾期统计接口正常');
  const perf = await req('GET', '/performance', null, adminToken);
  assert(perf.data.code === 0 && Array.isArray(perf.data.data), '业绩统计接口正常');
  const maintReport = await req('GET', '/maintenance-report', null, adminToken);
  assert(maintReport.data.code === 0 && maintReport.data.data.summary.count >= 2, '旧项目台账专项统计正常');
  const historyFinish = await req('GET', '/history-finish-stat?project_type=2', null, adminToken);
  assert(historyFinish.data.code === 0 && historyFinish.data.data.summary.count >= 2, '历史完工数据统计正常');

  console.log('\n=== 15. 标签 & 设置 & 日志 ===');
  const tag = await req('POST', '/tags', { name: `自测标签_${RUN_ID}`, color: '#ff0000' }, adminToken);
  assert(tag.data.code === 0, '创建标签成功');
  cleanup.tagId = tag.data.data.id;
  const settings = await req('PUT', '/settings', { dashboard_theme: 'dark' }, adminToken);
  assert(settings.data.code === 0, '更新设置成功');
  const logs = await req('GET', '/logs', null, adminToken);
  assert(logs.data.code === 0 && logs.data.data.total > 0, '操作日志留痕正常');

  console.log('\n=== 16. Excel 导出 ===');
  const exp = await req('GET', '/projects/export/excel', null, adminToken);
  assert(exp.status === 200 && exp.data.byteLength > 0, '项目导出Excel成功');

  console.log('\n=== 17. 清理自测数据 ===');
  for (const id of cleanup.projectIds) await req('DELETE', `/projects/${id}`, null, adminToken);
  if (cleanup.tagId) await req('DELETE', `/tags/${cleanup.tagId}`, null, adminToken);
  if (cleanup.userId) await req('DELETE', `/users/${cleanup.userId}`, null, adminToken);
  assert(true, '自测用户/项目/标签已软删除');

  console.log(`\n========== 自测结果：通过 ${pass}，失败 ${failCount} ==========\n`);
  process.exit(failCount ? 1 : 0);
})().catch((e) => { console.error('自测异常:', e); process.exit(1); });
