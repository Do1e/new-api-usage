# New API Usage

一个专为 [new-api](https://github.com/QuantumNous/new-api) 打造的轻量级可视化仪表板。

直接读取 new-api 数据库中的 `logs` 表，将原始的调用记录转化为直观的图表和统计数据，帮助你更好地理解 API 的使用状况、Token 消耗分布以及流量趋势。

---

## 核心功能

*   **数据汇总**：实时统计总调用次数、输入/输出及缓存 Token 用量。
*   **趋势分析**：通过时间序列图表观察调用量和 Token 消耗的变化波动。
*   **多维分布**：按用户、模型、渠道等维度进行饼图分析，直观展示用量占比。
*   **日志明细**：支持分页浏览详细调用记录，并提供强大的多条件筛选功能。

## 技术选型

项目采用了现代且成熟的技术栈，确保开发体验与运行效率：

*   **框架**：Next.js 16 (App Router) + React 19 + TypeScript
*   **UI**：shadcn/ui + Tailwind CSS v4 + Lucide Icons
*   **图表**：Recharts
*   **数据**：PostgreSQL / MySQL + jose (JWT)

---

## 快速部署

### Docker 部署（推荐）

使用 Docker 镜像是最快的方式。请确保设置了正确的环境变量。

```bash
docker run -d \
  --name new-api-usage \
  -p 3000:3000 \
  --restart unless-stopped \
  -e DATABASE_URL="postgres://username:password@host:5432/database_name" \
  -e DASHBOARD_PASSWORD="your_password" \
  -e SESSION_SECRET="your_random_secret" \
  -e DEFAULT_RECENT_DAYS=7 \
  -e COST_CURRENCY_SYMBOL="¥" \
  -e COST_EXCHANGE_RATE="1:7" \
  -e TZ="Asia/Shanghai" \
  do1e/new-api-usage:latest
```

*   `DATABASE_URL`: 指向你的 new-api 数据库，支持 PostgreSQL URL，也支持 MySQL 连接串；程序会在运行时自动识别。
*   `DASHBOARD_PASSWORD`: 仪表板的登录密码。
*   `SESSION_SECRET`: 用于 JWT 签名的随机字符串（可以使用 `openssl rand -base64 32` 生成）。
*   `DEFAULT_RECENT_DAYS`: 仪表板默认展示的最近 N 天数据（0 表示展示所有数据）。
*   `COST_CURRENCY_SYMBOL`: 费用展示的货币符号，默认 `$`，人民币可设置为 `¥`。
*   `COST_EXCHANGE_RATE`: 费用换算倍率，默认 `1:1`，人民币示例为 `1:7`。

### Docker Compose

docker-compose.yml 文件已包含完整配置，按需（必填项可搜索 `edit-me`）修改环境变量后运行：

```bash
docker compose up -d
```

更新镜像：

```bash
docker compose pull
docker compose down
docker compose up -d
```

---

## 本地开发

如果你需要进行二次开发或本地运行：

1.  **环境要求**：Node.js 18+，推荐使用 pnpm。
2.  **克隆项目**：
    ```bash
    git clone https://github.com/Do1e/new-api-usage.git
    cd new-api-usage
    ```
3.  **安装依赖**：`pnpm install`
4.  **配置文件**：复制 `.env.example` 为 `.env` 并填写数据库及密码信息。`DATABASE_URL` 支持 PostgreSQL 和 MySQL。
5.  **启动开发环境**：`pnpm dev`

---

## 项目结构

```text
app/                 # Next.js 路由与 API 逻辑
├── api/             # 统计、筛选及日志查询接口
├── dashboard/       # 仪表板主要交互页面
└── login/           # 认证页面

components/          # React 组件
├── dashboard/       # 统计卡片、图表、过滤器及表格组件
└── ui/              # 基于 shadcn 的基础 UI 组件

lib/                 # 数据库连接池与通用工具函数
```
