-- ============================================================
-- 项目接单管理后台 - MySQL 建表脚本（生产环境迁移用）
-- 字符集 utf8mb4，逻辑软删除
-- 默认管理员：admin / Ccj940904（密码为 bcrypt 加密，见文末说明）
-- ============================================================

CREATE DATABASE IF NOT EXISTS project_admin DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE project_admin;

-- ---------- 用户表 ----------
CREATE TABLE IF NOT EXISTS users (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  username    VARCHAR(64) NOT NULL UNIQUE COMMENT '登录账号',
  password    VARCHAR(255) NOT NULL COMMENT 'bcrypt加密密码',
  name        VARCHAR(64) NOT NULL COMMENT '姓名',
  role        VARCHAR(16) NOT NULL DEFAULT 'tech' COMMENT 'admin/tech',
  phone       VARCHAR(32) COMMENT '联系方式',
  bank_account VARCHAR(64) DEFAULT '' COMMENT '技术员收款银行卡号',
  status      TINYINT NOT NULL DEFAULT 1 COMMENT '1启用0禁用',
  deleted     TINYINT NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ---------- 项目主表 ----------
CREATE TABLE IF NOT EXISTS projects (
  id                    BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_type          TINYINT NOT NULL DEFAULT 1 COMMENT '项目类型：1=常规开发项目 2=历史维护完结项目',
  name                  VARCHAR(255) NOT NULL COMMENT '项目名称',
  description           TEXT NOT NULL COMMENT '项目描述',
  requirement           TEXT NOT NULL COMMENT '项目要求',
  duration              VARCHAR(64) NOT NULL COMMENT '项目工期',
  customer_name         VARCHAR(64) NULL DEFAULT '' COMMENT '客户姓名（选填）',
  customer_phone        VARCHAR(32) NULL DEFAULT '' COMMENT '客户联系方式（手机号/字符串，选填）',
  group_name            VARCHAR(128) NULL DEFAULT '' COMMENT '项目群名',
  tech_id               BIGINT NULL COMMENT '分配技术员；project_type=2时必须为空',
  status                VARCHAR(16) NOT NULL DEFAULT 'pending' COMMENT 'pending/stage1-5/completed；project_type=2固定completed',
  start_time            DATE NULL COMMENT '项目开始时间',
  total_reward          DECIMAL(12,2) DEFAULT 0 COMMENT '开发总酬劳',
  first_payment         DECIMAL(12,2) DEFAULT 0 COMMENT '首付款',
  mid_payment           DECIMAL(12,2) DEFAULT 0 COMMENT '中期款',
  final_payment         DECIMAL(12,2) DEFAULT 0 COMMENT '尾款',
  project_cost          DECIMAL(12,2) DEFAULT 0 COMMENT '项目成本',
  tech_fee              DECIMAL(12,2) DEFAULT 0 COMMENT '技术费用',
  server_first_push     VARCHAR(8) NULL COMMENT '是/否',
  server_owner          VARCHAR(8) NULL COMMENT '个人/公司',
  server_location       VARCHAR(128) NULL COMMENT '服务器位置',
  server_start_date     DATE NULL,
  server_buy_date       DATE NULL,
  server_expire_date    DATE NULL COMMENT '服务器到期提醒时间',
  maintenance_amount    DECIMAL(12,2) DEFAULT 0 COMMENT '维护金额',
  maintenance_expire_date DATE NULL COMMENT '维护费到期提醒时间',
  remark                TEXT NULL COMMENT '备注',
  actual_finish_time    DATE NULL COMMENT '实际完工时间，支持历史旧项目手动录入',
  settled               TINYINT NOT NULL DEFAULT 0 COMMENT '0未结算1已结算',
  payment_requested     TINYINT NOT NULL DEFAULT 0 COMMENT '是否已提交付款申请',
  source_uploaded       TINYINT NULL COMMENT '源码是否上传 1是0否',
  payment_request_time  DATETIME NULL,
  locked                TINYINT NOT NULL DEFAULT 0 COMMENT '付款申请后锁定',
  deleted               TINYINT NOT NULL DEFAULT 0,
  created_by            BIGINT NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_type (project_type),
  INDEX idx_tech (tech_id),
  INDEX idx_status (status),
  INDEX idx_finish_time (actual_finish_time),
  INDEX idx_created_at (created_at),
  INDEX idx_type_finish (project_type, actual_finish_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目主表';

-- ---------- 项目附件表 ----------
CREATE TABLE IF NOT EXISTS project_files (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id    BIGINT NOT NULL,
  original_name VARCHAR(512) NOT NULL,
  stored_name   VARCHAR(512) NOT NULL,
  file_path     VARCHAR(1024) NOT NULL,
  size          BIGINT NOT NULL,
  mime          VARCHAR(128),
  uploaded_by   BIGINT,
  deleted       TINYINT NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目附件表';

-- ---------- 标签表 ----------
CREATE TABLE IF NOT EXISTS tags (
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  name       VARCHAR(64) NOT NULL UNIQUE,
  color      VARCHAR(16) DEFAULT '#0071e3',
  deleted    TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目标签表';

-- ---------- 项目-标签关联 ----------
CREATE TABLE IF NOT EXISTS project_tags (
  project_id BIGINT NOT NULL,
  tag_id     BIGINT NOT NULL,
  PRIMARY KEY (project_id, tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目标签关联';

-- ---------- 资金台账 ----------
CREATE TABLE IF NOT EXISTS ledger (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id  BIGINT NULL,
  custom_name VARCHAR(128) DEFAULT '' COMMENT '非项目类自定义流水名称',
  type        VARCHAR(16) NOT NULL COMMENT 'first/mid/final/maintenance/cost/techfee/other',
  amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
  direction   VARCHAR(8) NOT NULL DEFAULT 'in' COMMENT 'in收入/out支出',
  received_at DATE NULL COMMENT '收付款时间',
  operator_id BIGINT NULL,
  remark      VARCHAR(512),
  deleted     TINYINT NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资金台账';

-- ---------- 核心业务统计SQL示例 ----------
-- 平台全量营收/利润（默认合并常规项目+历史维护完结项目）
-- SELECT COUNT(*) total_projects,
--        SUM(first_payment + mid_payment + final_payment) total_income,
--        SUM(project_cost + tech_fee) total_cost,
--        SUM(first_payment + mid_payment + final_payment - project_cost - tech_fee) total_profit
-- FROM projects
-- WHERE deleted=0;
--
-- 单独筛选项目类型：project_type=1 常规，project_type=2 历史维护完结
-- SELECT * FROM projects WHERE deleted=0 AND project_type=? ORDER BY id DESC;
--
-- 技术员个人承接/业绩隔离：只统计常规分配项目
-- SELECT * FROM projects WHERE deleted=0 AND project_type=1 AND tech_id=?;
--
-- 历史完工趋势：按实际完工时间统计，默认可合并全部类型，也可追加 project_type 条件
-- SELECT DATE_FORMAT(actual_finish_time, '%Y-%m') ym,
--        COUNT(*) count,
--        SUM(first_payment + mid_payment + final_payment) income,
--        SUM(first_payment + mid_payment + final_payment - project_cost - tech_fee) profit
-- FROM projects
-- WHERE deleted=0 AND actual_finish_time IS NOT NULL
-- GROUP BY DATE_FORMAT(actual_finish_time, '%Y-%m')
-- ORDER BY ym;

-- ---------- 操作日志 ----------
CREATE TABLE IF NOT EXISTS logs (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id     BIGINT NULL,
  user_name   VARCHAR(64),
  action      VARCHAR(64) NOT NULL,
  target_type VARCHAR(32),
  target_id   BIGINT,
  detail      VARCHAR(1024),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志';

-- ---------- 进度流转记录 ----------
CREATE TABLE IF NOT EXISTS progress_logs (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id  BIGINT NOT NULL,
  from_status VARCHAR(16),
  to_status   VARCHAR(16) NOT NULL,
  note        VARCHAR(1024),
  operator_id BIGINT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='进度流转记录';

-- ---------- 系统设置 ----------
CREATE TABLE IF NOT EXISTS settings (
  `key`  VARCHAR(64) PRIMARY KEY,
  value  VARCHAR(1024)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统设置';

-- ============================================================
-- 初始化数据
-- 默认管理员密码 Ccj940904 的 bcrypt 值（$2a$10$...）
-- 注意：下方 hash 为示例，请用 backend 的 bcryptjs 重新生成，或直接用 Node 版自动 seed。
-- 生成命令：node -e "console.log(require('bcryptjs').hashSync('Ccj940904',10))"
-- ============================================================
INSERT INTO users (username, password, name, role, phone, status)
VALUES ('admin', '$2a$10$/d0UZQFVqD5nhyK95p.V0OhcNYVvLcbMni1ILTfFdXRxqFnNNv4.2', '超级管理员', 'admin', '13800000000', 1);

INSERT INTO settings (`key`, value) VALUES
  ('upload_dir', ''),
  ('max_file_size_mb', '200'),
  ('dashboard_theme', 'light');
