/**
 * 项目附件管理
 * - 管理员：上传/替换/删除，任意项目
 * - 技术员：仅可下载分配给自己的常规项目附件（维护项目附件技术员不可见）
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { ok, fail } = require('../utils/resp');
const { authRequired, adminOnly } = require('../middleware/auth');
const { upload, getUploadDir } = require('../middleware/upload');
const { writeLog } = require('../utils/logger');
const { isHistoryProject } = require('../utils/projectType');

const router = express.Router();

// 上传附件到指定项目（仅管理员，支持多文件）
router.post('/:projectId', authRequired, adminOnly, (req, res) => {
  upload.array('files', 20)(req, res, (err) => {
    if (err) return fail(res, err.message);
    const projectId = Number(req.params.projectId);
    const p = db.prepare(`SELECT * FROM projects WHERE id=? AND deleted=0`).get(projectId);
    if (!p) return fail(res, '项目不存在', 404);
    if (!req.files || !req.files.length) return fail(res, '没有收到文件');

    const ins = db.prepare(
      `INSERT INTO project_files (project_id, original_name, stored_name, file_path, size, mime, uploaded_by) VALUES (?,?,?,?,?,?,?)`
    );
    const saved = [];
    for (const f of req.files) {
      const info = ins.run(projectId, f.originalname, f.filename, f.filename, f.size, f.mimetype, req.user.id);
      saved.push({ id: info.lastInsertRowid, name: f.originalname });
    }
    writeLog({ user: req.user, action: 'upload_files', targetType: 'project', targetId: projectId, detail: `上传 ${saved.length} 个附件` });
    return ok(res, saved, '上传成功');
  });
});

// 下载附件
router.get('/:fileId/download', authRequired, (req, res) => {
  const fileId = Number(req.params.fileId);
  const f = db.prepare(`SELECT * FROM project_files WHERE id=? AND deleted=0`).get(fileId);
  if (!f) return fail(res, '文件不存在', 404);
  const p = db.prepare(`SELECT * FROM projects WHERE id=? AND deleted=0`).get(f.project_id);
  if (!p) return fail(res, '项目不存在', 404);
  // 技术员权限：仅自己的常规项目
  if (req.user.role === 'tech' && (isHistoryProject(p) || p.tech_id !== req.user.id)) {
    return fail(res, '无权下载该附件', 403);
  }
  const full = path.join(getUploadDir(), f.stored_name);
  if (!fs.existsSync(full)) return fail(res, '文件已丢失', 404);
  res.download(full, f.original_name);
});

// 删除附件（仅管理员）
router.delete('/:fileId', authRequired, adminOnly, (req, res) => {
  const fileId = Number(req.params.fileId);
  const f = db.prepare(`SELECT * FROM project_files WHERE id=? AND deleted=0`).get(fileId);
  if (!f) return fail(res, '文件不存在', 404);
  db.prepare(`UPDATE project_files SET deleted=1 WHERE id=?`).run(fileId);
  // 物理文件也移除（附件非核心业务数据）
  try {
    const full = path.join(getUploadDir(), f.stored_name);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch (e) { /* ignore */ }
  writeLog({ user: req.user, action: 'delete_file', targetType: 'project', targetId: f.project_id, detail: `删除附件：${f.original_name}` });
  return ok(res, null, '删除成功');
});

module.exports = router;
