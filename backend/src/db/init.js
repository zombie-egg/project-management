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
  console.log('✅ 数据库表结构初始化完成');
}

if (require.main === module) {
  initDb();
}

module.exports = initDb;
