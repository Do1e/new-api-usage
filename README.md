# New API Usage

API 用量统计仪表板，用于可视化展示和分析 API 调用日志。基于 [new-api](https://github.com/QuantumNous/new-api) 的 `logs` 表数据，提供调用统计、Token 用量分析、时间趋势图表等功能。

## 功能特性

- **汇总统计卡片** — 总调用次数、输入/输出/缓存 Token 数量一览
- **时间趋势图表** — 调用量和 Token 用量的时间序列变化
- **分布饼图** — 按用户、模型维度的调用分布
- **日志明细表** — 分页浏览详细调用记录，支持筛选
- **多维度筛选** — 按时间范围、用户、模型、渠道筛选数据
- **登录认证** — 密码登录 + JWT Session 验证
- **明暗主题** — 支持亮色/暗色主题切换
- **Docker 部署** — 提供完整 Dockerfile 和 docker-compose 配置

## 技术栈

- **框架**: Next.js 16 (App Router) + React 19 + TypeScript
- **UI**: shadcn/ui + Tailwind CSS v4 + Radix UI
- **图表**: Recharts
- **数据库**: PostgreSQL (通过 `pg` 库连接)
- **认证**: JWT (jose)
- **包管理**: pnpm

## 前置要求

- Node.js >= 18
- PostgreSQL 数据库（需包含 new-api 的 `public.logs` 表）
- pnpm

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/inflow-lab/new-api-usage.git
cd new-api-usage
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

```env
# 数据库连接地址（指向 new-api 的数据库）
DATABASE_URL=postgres://username:password@localhost:5432/database_name

# 仪表板登录密码
DASHBOARD_PASSWORD=your_secure_password_here

# 可选：JWT 签名密钥（未设置时自动生成）
# SESSION_SECRET=your_random_secret_key_here
```

### 4. 启动开发服务器

```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000)，使用 `DASHBOARD_PASSWORD` 设置的密码登录。

## Docker 部署

### 构建镜像

```bash
docker build -t new-api-usage:latest .
```

### 使用 docker-compose 运行

1. 创建 `.env.docker` 文件并填写环境变量
2. 启动服务：

```bash
docker-compose up -d
```

服务将在 `3000` 端口启动，默认时区为 `Asia/Shanghai`。

## 项目结构

```
app/
├── api/
│   ├── auth/              # 登录认证接口
│   ├── filters/           # 筛选选项接口
│   ├── logs/              # 日志查询接口
│   └── stats/             # 统计数据接口
│       ├── summary/       # 汇总统计
│       ├── time-series/   # 时间趋势
│       ├── models/        # 模型分布
│       └── users/         # 用户分布
├── dashboard/             # 仪表板页面
├── login/                 # 登录页面
├── layout.tsx             # 根布局
├── page.tsx               # 入口页面（自动重定向）
└── globals.css            # 全局样式

components/
├── dashboard/             # 仪表板业务组件
│   ├── summary-cards.tsx  # 统计卡片
│   ├── call-count-chart.tsx  # 调用趋势图
│   ├── token-pie-chart.tsx   # Token 分布图
│   ├── model-pie-charts.tsx  # 模型分布图
│   ├── user-pie-charts.tsx   # 用户分布图
│   ├── logs-table.tsx        # 日志表格
│   └── filters.tsx           # 筛选器
├── ui/                    # shadcn/ui 基础组件
├── theme-provider.tsx     # 主题提供者
└── theme-toggle.tsx       # 主题切换按钮

lib/
├── db.ts                  # PostgreSQL 连接池
└── utils.ts               # 工具函数
```

## 数据库依赖

本项目直接读取 new-api 数据库中的 `public.logs` 表，主要使用以下字段：

| 字段 | 说明 |
|------|------|
| `id` | 日志 ID |
| `created_at` | 创建时间（Unix 时间戳） |
| `username` | 用户名 |
| `user_id` | 用户 ID |
| `model_name` | 模型名称 |
| `channel_name` | 渠道名称 |
| `channel_id` | 渠道 ID |
| `is_stream` | 是否流式请求 |
| `use_time` | 耗时（ms） |
| `prompt_tokens` | 输入 Token 数 |
| `completion_tokens` | 输出 Token 数 |
| `other` | 扩展信息 JSON（含 `cache_tokens`、`frt` 等） |

## 开发

```bash
# 开发服务器
pnpm dev

# 代码检查
pnpm lint

# 类型检查
pnpm type-check

# 生产构建
pnpm build
```

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接字符串 |
| `DASHBOARD_PASSWORD` | 是 | 仪表板登录密码 |
| `SESSION_SECRET` | 否 | JWT 签名密钥，未设置时使用默认值 |
