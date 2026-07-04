/**
 * 操作日志记录工具
 * 所有账号的新增、编辑、分配、进度流转、付款申请、资金修改全部留痕。
 */
const db = require('../db');

function writeLog({ user, action, targetType, targetId, detail }) {
  try {
    db.prepare(
      `INSERT INTO logs (user_id, user_name, action, target_type, target_id, detail)
       VALUES (?,?,?,?,?,?)`
    ).run(
      user ? user.id : null,
      user ? user.name : 'system',
      action,
      targetType || null,
      targetId || null,
      detail || null
    );
  } catch (e) {
    // 日志失败不影响主流程
    console.error('写日志失败:', e.message);
  }
}

module.exports = { writeLog };
