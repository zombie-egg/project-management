# 项目接单管理后台系统

苹果极简风格的项目接单 / 维护 / 资金 / 数据大屏一体化管理后台。前后端分离，开箱即跑。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Vue3 + Vite + Element Plus + TailwindCSS + ECharts + Pinia + Vue Router |
| 后端 | Node.js + Express + better-sqlite3（内置 SQLite，零配置） |
| 鉴权 | JWT Token + 角色权限（管理员 / 技术员） |
| 导出 | ExcelJS |
| 生产数据库 | 附 MySQL 建表脚本 `docs/mysql_schema.sql` |

## 目录结构

```
项目统计/
├── backend/                 后端服务
│   ├── src/
│   │   ├── config.js        全局配置
│   │   ├── server.js        服务入口（首启自动建表+种子）
│   │   ├── db/              schema.sql / init.js / seed.js / index.js
│   │   ├── middleware/      auth.js（鉴权）/ upload.js（文件上传）
│   │   ├── routes/          auth/users/projects/files/dashboard/ledger/misc
│   │   └── utils/           profit.js（利润计算）/ logger.js / resp.js
│   ├── scripts/selftest.js  接口自测脚本（37 项）
│   ├── data/                SQLite 数据文件（自动生成）
│   └── uploads/             上传附件目录（自动生成）
├── frontend/                前端
│   └── src/
│       ├── api/             axios 封装 + 全量接口
│       ├── layouts/         主布局（侧边栏+顶栏+到期预警）
│       ├── views/           admin/ tech/ 及共享详情页
│       ├── store/           Pinia 用户态
│       └── router/          路由 + 角色守卫
└── docs/                    部署 / API / 使用文档 / MySQL 脚本
```

## 快速启动（本地开发）

### 1. 启动后端（默认端口 3000）

```bash
cd backend
npm install
npm start        # 首次启动自动建表并写入种子数据
```

启动后访问 http://localhost:3000/api/health 应返回 `{"code":0,...}`。

### 2. 启动前端（默认端口 5173，已配置 /api 代理到后端）

```bash
cd frontend
npm install
npm run dev
```

打开 http://localhost:5173

### 3. 默认账号

| 角色 | 账号 | 密码 |
|------|------|------|
| 管理员 | admin | admin123 |
| 技术员 | tech01 | tech123 |
| 技术员 | tech02 | tech123 |

## 后端接口自测

```bash
cd backend
npm start                 # 终端 A
npm run test:api          # 终端 B —— 覆盖登录/鉴权/CRUD/利润/筛选/流转/付款/台账/大屏/导出等 37 项
```

## 更多文档

- 部署教程与环境依赖：[docs/部署文档.md](docs/部署文档.md)
- 接口文档：[docs/接口文档.md](docs/接口文档.md)
- 使用操作手册：[docs/使用手册.md](docs/使用手册.md)
- MySQL 建表脚本：[docs/mysql_schema.sql](docs/mysql_schema.sql)
