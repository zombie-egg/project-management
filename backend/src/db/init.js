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
  migrateLedgerForCustomEntries();
}

function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function migrateLedgerForCustomEntries() {
  const cols = db.prepare('PRAGMA table_info(ledger)').all();
  const projectCol = cols.find((c) => c.name === 'project_id');
  const hasCustomName = cols.some((c) => c.name === 'custom_name');
  if (projectCol && projectCol.notnull === 0 && hasCustomName) return;

  db.exec('PRAGMA foreign_keys=OFF');
  const tx = db.transaction(() => {
    db.exec('DROP INDEX IF EXISTS idx_ledger_project');
    db.exec('ALTER TABLE ledger RENAME TO ledger_old');
    db.exec(`
      CREATE TABLE ledger (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id  INTEGER,
        custom_name TEXT DEFAULT '',
        type        TEXT NOT NULL,
        amount      REAL NOT NULL DEFAULT 0,
        direction   TEXT NOT NULL DEFAULT 'in',
        received_at TEXT,
        operator_id INTEGER,
        remark      TEXT,
        deleted     INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);
    db.exec(`
      INSERT INTO ledger (id, project_id, custom_name, type, amount, direction, received_at, operator_id, remark, deleted, created_at)
      SELECT id, project_id, '', type, amount, direction, received_at, operator_id, remark, deleted, created_at
      FROM ledger_old
    `);
    db.exec('DROP TABLE ledger_old');
    db.exec('CREATE INDEX IF NOT EXISTS idx_ledger_project ON ledger(project_id)');
  });
  tx();
  db.exec('PRAGMA foreign_keys=ON');
}

if (require.main === module) {
  initDb();
}

module.exports = initDb;
