-- ============================================================
-- 项目接单管理后台 - SQLite 建表脚本
-- 说明：所有业务表均带 deleted 字段做逻辑软删除（0=正常 1=已删除）
-- ============================================================

PRAGMA foreign_keys = ON;

-- ---------- 用户表（管理员 + 技术员，统一表，role 区分）----------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,           -- 登录账号
  password      TEXT NOT NULL,                  -- bcrypt 加密后的密码
  name          TEXT NOT NULL,                  -- 姓名
  role          TEXT NOT NULL DEFAULT 'tech',   -- admin / tech
  phone         TEXT,                           -- 联系方式
  status        INTEGER NOT NULL DEFAULT 1,     -- 账号状态 1=启用 0=禁用
  deleted       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ---------- 项目主表 ----------
CREATE TABLE IF NOT EXISTS projects (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 项目类型：1=常规开发项目 2=历史维护完结项目
  project_type          INTEGER NOT NULL DEFAULT 1,
  -- 必填字段
  name                  TEXT NOT NULL,          -- 项目名称
  description           TEXT NOT NULL,          -- 项目描述
  requirement           TEXT NOT NULL,          -- 项目要求（文字说明，附件另存 project_files）
  duration              TEXT NOT NULL,          -- 项目工期
  customer_name         TEXT DEFAULT '',        -- 客户姓名（选填）
  customer_phone        TEXT DEFAULT '',        -- 客户联系方式（选填）
  -- 分配技术员（project_type=2 恒为 NULL）
  tech_id               INTEGER,
  -- 项目状态：常规项目流转5阶段；历史维护完结项目固定 completed
  -- pending=待接单 stage1..stage5 / completed=已完工-已完结
  status                TEXT NOT NULL DEFAULT 'pending',
  -- 选填字段
  start_time            TEXT,                   -- 项目开始时间
  total_reward          REAL DEFAULT 0,         -- 开发总酬劳
  first_payment         REAL DEFAULT 0,         -- 首付款
  mid_payment           REAL DEFAULT 0,         -- 中期款
  final_payment         REAL DEFAULT 0,         -- 尾款
  project_cost          REAL DEFAULT 0,         -- 项目成本金额
  tech_fee              REAL DEFAULT 0,         -- 技术费用
  server_first_push     TEXT,                   -- 服务器是否首推：是/否
  server_owner          TEXT,                   -- 服务器终推归属：个人/公司
  server_start_date     TEXT,                   -- 服务器开始日期
  server_buy_date       TEXT,                   -- 服务器购买时间
  server_expire_date    TEXT,                   -- 服务器到期提醒时间
  maintenance_amount    REAL DEFAULT 0,         -- 维护金额
  remark                TEXT,                   -- 备注信息
  actual_finish_time    TEXT,                   -- 项目实际完工时间（旧项目手动录入统计）
  -- 结算状态：0=未结算 1=已结算（尾款到账）
  settled               INTEGER NOT NULL DEFAULT 0,
  -- 付款申请相关（技术员提交）
  payment_requested     INTEGER NOT NULL DEFAULT 0,  -- 是否已提交付款申请
  source_uploaded       INTEGER,                     -- 源码是否上传：1=是 0=否 NULL=未提交
  payment_request_time  TEXT,
  locked                INTEGER NOT NULL DEFAULT 0,   -- 提交付款申请后锁定
  deleted               INTEGER NOT NULL DEFAULT 0,
  created_by            INTEGER,
  created_at            TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (tech_id) REFERENCES users(id)
);

-- ---------- 项目附件表 ----------
CREATE TABLE IF NOT EXISTS project_files (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    INTEGER NOT NULL,
  original_name TEXT NOT NULL,        -- 原始文件名
  stored_name   TEXT NOT NULL,        -- 存储文件名
  file_path     TEXT NOT NULL,        -- 相对存储路径
  size          INTEGER NOT NULL,     -- 字节大小
  mime          TEXT,
  uploaded_by   INTEGER,
  deleted       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- ---------- 项目标签定义表 ----------
CREATE TABLE IF NOT EXISTS tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  color      TEXT DEFAULT '#0071e3',
  deleted    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ---------- 项目-标签关联表 ----------
CREATE TABLE IF NOT EXISTS project_tags (
  project_id INTEGER NOT NULL,
  tag_id     INTEGER NOT NULL,
  PRIMARY KEY (project_id, tag_id)
);

-- ---------- 资金流水台账表 ----------
CREATE TABLE IF NOT EXISTS ledger (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL,
  -- 款项类型：first=首付款 mid=中期款 final=尾款 maintenance=维护款 cost=成本支出 techfee=技术费用
  type        TEXT NOT NULL,
  amount      REAL NOT NULL DEFAULT 0,
  -- 方向：in=收入 out=支出
  direction   TEXT NOT NULL DEFAULT 'in',
  received_at TEXT,                    -- 收/付款时间
  operator_id INTEGER,                 -- 操作人
  remark      TEXT,
  deleted     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- ---------- 操作日志表 ----------
CREATE TABLE IF NOT EXISTS logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER,
  user_name   TEXT,
  action      TEXT NOT NULL,           -- 动作类型
  target_type TEXT,                    -- 目标类型 project/user/ledger...
  target_id   INTEGER,
  detail      TEXT,                    -- 详细描述
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ---------- 项目进度流转记录表 ----------
CREATE TABLE IF NOT EXISTS progress_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  note        TEXT,                    -- 阶段性工作备注
  operator_id INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- ---------- 系统设置表（键值对）----------
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_projects_type   ON projects(project_type);
CREATE INDEX IF NOT EXISTS idx_projects_tech   ON projects(tech_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_files_project   ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_ledger_project  ON ledger(project_id);
CREATE INDEX IF NOT EXISTS idx_progress_project ON progress_logs(project_id);
