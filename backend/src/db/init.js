/**
 * 初始化数据库：执行建表脚本
 * 用法：npm run init-db
 */
const fs = require('fs');
const path = require('path');
const db = require('./index');

function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);
  migrateColumns();
  console.log('✅ 数据库表结构初始化完成');
}

function migrateColumns() {
  ensureColumn('users', 'bank_account', "TEXT DEFAULT ''");
  ensureColumn('projects', 'group_name', "TEXT DEFAULT ''");
  ensureColumn('projects', 'server_location', 'TEXT');
  ensureColumn('projects', 'maintenance_expire_date', 'TEXT');
}

function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

if (require.main === module) {
  initDb();
}

module.exports = initDb;
