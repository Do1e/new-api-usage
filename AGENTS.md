# AGENTS.md - AI 编码助手指南

## 项目概述

这是一个基于 **Next.js 16 + React 19 + TypeScript** 的仪表板应用，使用 **shadcn/ui** 组件库和 **Tailwind CSS v4** 构建。项目采用 PostgreSQL 作为数据库，使用 JWT 进行身份验证。

## 构建/开发/检查命令

```bash
# 开发服务器
pnpm dev

# 生产构建
pnpm build

# 启动生产服务器
pnpm start

# 代码检查（ESLint）
pnpm lint
# 检查指定文件: pnpm lint <file1> <file2>

# 类型检查（TypeScript）
pnpm type-check
```

> ⚠️ **注意**: 本项目**没有配置测试框架**（如 Jest/Vitest），因此不存在运行单个测试的命令。

## Git Hooks

项目使用 Husky 配置了 pre-commit 钩子：
- 自动运行 `pnpm lint` 检查变更文件
- 当检测到 TS/TSX 文件变更时，自动运行 `pnpm type-check`

## 代码风格规范

### 导入排序（ESLint 强制）

必须使用严格的导入顺序（由 `import/order` 规则强制执行）：

```typescript
// 1. React 内置
import { useState, useEffect } from 'react';

// 2. Next.js 内置
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

// 3. 外部库
import { jwtVerify } from 'jose';
import { format } from 'date-fns';

// 4. 内部模块 (@/ 别名)
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { query } from '@/lib/db';

// 5. 类型导入（单独分组）
import type { Metadata } from 'next';
```

**关键规则**:
- 不同组之间必须有空行
- 每组内按字母顺序排序
- 使用 `type` 前缀进行类型导入
- React 和 Next.js 必须在最前面

### TypeScript 规范

- **严格模式**: 已启用 (`strict: true`)
- **返回值类型**: 函数不强制要求显式返回值类型
- **any 类型**: 尽量避免，使用时会触发警告
- **未使用变量**: 前缀为 `_` 可忽略检查
- **类型导入**: 必须使用 `type` 前缀，且单独导入

### React 组件规范

- **组件定义**: 必须使用箭头函数（由 ESLint 强制）
  ```typescript
  // ✅ 正确
  const MyComponent = ({ prop1, prop2 }: Props) => { ... };
  
  // ❌ 错误
  function MyComponent({ prop1, prop2 }: Props) { ... }
  ```

- **解构**: 必须解构 props 和 state（由 ESLint 强制）
- **自闭合标签**: 无子元素时必须使用自闭合（由 ESLint 强制）
- **JSX 中不展开 props**: 允许使用 `{...props}`

### 命名规范

- **组件**: PascalCase（如 `Filters.tsx`）
- **工具函数**: camelCase（如 `cn()`）
- **类型/接口**: PascalCase（如 `FilterState`）
- **常量**: UPPER_SNAKE_CASE（如 `SESSION_SECRET`）
- **文件**: 小写短横线（kebab-case，如 `time-series-charts.tsx`）

### 错误处理

- API 路由中统一使用 try-catch 包裹业务逻辑
- 返回标准的 JSON 错误响应：
  ```typescript
  return NextResponse.json(
    { error: '错误描述' },
    { status: 500 }
  );
  ```
- 组件中使用 `console.error()` 记录错误

### 代码格式

- **引号**: 单引号（字符串），双引号（JSX 属性）
- **分号**: 必须
- **箭头函数参数**: 必须加括号
- **对象简写**: 优先使用（`{ foo }` 而非 `{ foo: foo }`）
- **模板字符串**: 优先使用而非字符串拼接

## 项目结构

```
app/                    # Next.js App Router
├── api/                # API 路由
│   ├── auth/           # 认证相关
│   ├── filters/        # 筛选选项 API
│   ├── logs/           # 日志查询 API
│   └── stats/          # 统计 API
├── login/              # 登录页面
├── dashboard/          # 仪表板页面
├── layout.tsx          # 根布局
├── page.tsx            # 根页面（重定向逻辑）
└── globals.css         # 全局样式

components/             # React 组件
├── ui/                 # shadcn/ui 基础组件
└── dashboard/          # 仪表板业务组件

lib/                    # 工具函数
├── utils.ts            # cn() 工具函数
└── db.ts               # PostgreSQL 连接池

public/                 # 静态资源
```

## 关键配置

- **路径别名**: `@/` 映射到项目根目录
- **包管理器**: pnpm
- **CSS**: Tailwind CSS v4 + shadcn/ui 主题
- **数据库**: PostgreSQL（使用 `pg` 库）

## 环境变量

需要以下环境变量（参考 `.env.example`）：
- `DATABASE_URL`: PostgreSQL 连接字符串
- `DASHBOARD_PASSWORD`: 仪表板登录密码
- `SESSION_SECRET`: JWT 签名密钥

所有的环境变量都应当在 `lib/env.ts` 中进行定义并使用 `zod` 验证。

## 注意事项

1. 包管理务必使用 **pnpm**，避免使用 npm 或 yarn
2. 提交代码前会自动运行 lint 和 type-check，确保通过后再提交
3. 使用 shadcn/ui 组件时，通过 `pnpm dlx shadcn add <组件名>` 安装
4. 图标库使用 Lucide React
