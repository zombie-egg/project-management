/**
 * 初始化种子数据：默认管理员 + 示例技术员 + 示例项目（含旧维护项目）
 * 用法：npm run seed
 */
const bcrypt = require('bcryptjs');
const db = require('./index');
const initDb = require('./init');
const { computeProfit } = require('../utils/profit');

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'Ccj940904';
const ADMIN_PASSWORD_VERSION = '20260704_ccj940904';

function seed() {
  initDb();

  const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

  // 若已存在管理员，同步一次当前交付密码；之后用户自行改密不会被重启覆盖。
  const adminExists = db.prepare('SELECT id FROM users WHERE username=?').get(ADMIN_USERNAME);
  if (adminExists) {
    const version = db.prepare("SELECT value FROM settings WHERE key='admin_password_seed_version'").get();
    if (version?.value !== ADMIN_PASSWORD_VERSION) {
      db.prepare(
        `UPDATE users SET password=?, status=1, updated_at=datetime('now','localtime') WHERE id=?`
      ).run(bcrypt.hashSync(ADMIN_PASSWORD, 10), adminExists.id);
      db.prepare(`INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)`)
        .run('admin_password_seed_version', ADMIN_PASSWORD_VERSION);
      console.log('ℹ️  已存在数据，已同步管理员默认密码，跳过其他 seed。');
    } else {
      console.log('ℹ️  已存在数据，跳过 seed。');
    }
    return;
  }

  const insertUser = db.prepare(
    `INSERT INTO users (username, password, name, role, phone, status) VALUES (?,?,?,?,?,?)`
  );

  // 默认管理员：admin / Ccj940904
  const adminId = insertUser.run(
    ADMIN_USERNAME, bcrypt.hashSync(ADMIN_PASSWORD, 10), '超级管理员', 'admin', '13800000000', 1
  ).lastInsertRowid;

  // 示例技术员：tech01 / tech123
  const tech1 = insertUser.run(
    'tech01', bcrypt.hashSync('tech123', 10), '张三', 'tech', '13811111111', 1
  ).lastInsertRowid;
  const tech2 = insertUser.run(
    'tech02', bcrypt.hashSync('tech123', 10), '李四', 'tech', '13822222222', 1
  ).lastInsertRowid;

  // 标签
  const insertTag = db.prepare(`INSERT INTO tags (name, color) VALUES (?,?)`);
  const tagWeb = insertTag.run('Web开发', '#0071e3').lastInsertRowid;
  const tagApp = insertTag.run('小程序', '#34c759').lastInsertRowid;
  insertTag.run('重点客户', '#ff9500');

  // 项目插入
  const insertProject = db.prepare(`
    INSERT INTO projects (
      project_type, name, description, requirement, duration, customer_name, customer_phone,
      tech_id, status, start_time, total_reward, first_payment, mid_payment, final_payment,
      project_cost, tech_fee, server_first_push, server_owner, server_start_date,
      server_buy_date, server_expire_date, maintenance_amount, remark, actual_finish_time,
      settled, created_by
    ) VALUES (@project_type,@name,@description,@requirement,@duration,@customer_name,@customer_phone,
      @tech_id,@status,@start_time,@total_reward,@first_payment,@mid_payment,@final_payment,
      @project_cost,@tech_fee,@server_first_push,@server_owner,@server_start_date,
      @server_buy_date,@server_expire_date,@maintenance_amount,@remark,@actual_finish_time,
      @settled,@created_by)
  `);

  // 常规项目1：进行中
  const p1 = insertProject.run({
    project_type: 1, name: '企业官网重构', description: '为某科技公司重构官网', requirement: '响应式、SEO优化、CMS后台',
    duration: '30天', customer_name: '王总', customer_phone: '13900000001', tech_id: tech1, status: 'stage2',
    start_time: '2026-06-01', total_reward: 30000, first_payment: 10000, mid_payment: 10000, final_payment: 10000,
    project_cost: 3000, tech_fee: 8000, server_first_push: '是', server_owner: '公司', server_start_date: '2026-06-01',
    server_buy_date: '2026-05-28', server_expire_date: '2026-07-15', maintenance_amount: 2000, remark: '客户要求月底上线',
    actual_finish_time: null, settled: 0, created_by: adminId
  }).lastInsertRowid;

  // 常规项目2：待接单
  const p2 = insertProject.run({
    project_type: 1, name: '电商小程序', description: '生鲜电商微信小程序', requirement: '商品管理、下单、支付、配送',
    duration: '45天', customer_name: '赵经理', customer_phone: '13900000002', tech_id: tech2, status: 'pending',
    start_time: null, total_reward: 50000, first_payment: 15000, mid_payment: 0, final_payment: 0,
    project_cost: 0, tech_fee: 0, server_first_push: '否', server_owner: '个人', server_start_date: null,
    server_buy_date: null, server_expire_date: '2026-07-10', maintenance_amount: 0, remark: '',
    actual_finish_time: null, settled: 0, created_by: adminId
  }).lastInsertRowid;

  // 旧维护/完结项目1
  const p3 = insertProject.run({
    project_type: 2, name: '旧版ERP系统维护', description: '历史ERP系统线下收尾维护', requirement: '数据迁移、bug修复（已完成）',
    duration: '已完结', customer_name: '孙老板', customer_phone: '13900000003', tech_id: null, status: 'completed',
    start_time: '2025-01-10', total_reward: 20000, first_payment: 20000, mid_payment: 0, final_payment: 0,
    project_cost: 2000, tech_fee: 5000, server_first_push: '是', server_owner: '公司', server_start_date: '2025-01-10',
    server_buy_date: '2025-01-05', server_expire_date: '2026-08-01', maintenance_amount: 3000, remark: '线下完成，仅存档',
    actual_finish_time: '2025-03-20', settled: 1, created_by: adminId
  }).lastInsertRowid;

  // 旧维护/完结项目2
  const p4 = insertProject.run({
    project_type: 2, name: '门店收银系统', description: '连锁门店旧收银系统', requirement: '已交付完成',
    duration: '已完结', customer_name: '周店长', customer_phone: '13900000004', tech_id: null, status: 'completed',
    start_time: '2024-08-01', total_reward: 40000, first_payment: 20000, mid_payment: 10000, final_payment: 10000,
    project_cost: 5000, tech_fee: 12000, server_first_push: '否', server_owner: '个人', server_start_date: '2024-08-01',
    server_buy_date: '2024-07-20', server_expire_date: '2026-09-15', maintenance_amount: 0, remark: '历史订单归档',
    actual_finish_time: '2024-12-15', settled: 1, created_by: adminId
  }).lastInsertRowid;

  // 项目标签关联
  const insertPT = db.prepare(`INSERT INTO project_tags (project_id, tag_id) VALUES (?,?)`);
  insertPT.run(p1, tagWeb);
  insertPT.run(p2, tagApp);

  // 资金台账
  const insertLedger = db.prepare(
    `INSERT INTO ledger (project_id, type, amount, direction, received_at, operator_id, remark) VALUES (?,?,?,?,?,?,?)`
  );
  insertLedger.run(p1, 'first', 10000, 'in', '2026-06-01', adminId, '首付款到账');
  insertLedger.run(p1, 'mid', 10000, 'in', '2026-06-20', adminId, '中期款到账');
  insertLedger.run(p3, 'first', 20000, 'in', '2025-01-10', adminId, '旧项目全款');
  insertLedger.run(p4, 'first', 20000, 'in', '2024-08-01', adminId, '');
  insertLedger.run(p4, 'mid', 10000, 'in', '2024-10-01', adminId, '');
  insertLedger.run(p4, 'final', 10000, 'in', '2024-12-15', adminId, '尾款结清');

  // 默认系统设置
  const insertSetting = db.prepare(`INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)`);
  insertSetting.run('upload_dir', '');           // 空=使用默认
  insertSetting.run('max_file_size_mb', '200');
  insertSetting.run('dashboard_theme', 'light');
  insertSetting.run('admin_password_seed_version', ADMIN_PASSWORD_VERSION);

  console.log('✅ 种子数据初始化完成');
  console.log(`   管理员账号：admin / ${ADMIN_PASSWORD}`);
  console.log('   技术员账号：tech01 / tech123 , tech02 / tech123');
}

if (require.main === module) {
  seed();
}

module.exports = seed;
