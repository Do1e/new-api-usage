# MySQL Runtime Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add runtime PostgreSQL/MySQL support to the dashboard while keeping the existing API and frontend behavior unchanged.

**Architecture:** Introduce a small database-dialect layer that parses `DATABASE_URL`, chooses the correct driver, and provides SQL helpers for placeholders, table names, casts, and JSON metric extraction. Update the existing API routes to use these helpers so the route structure and response shapes stay stable.

**Tech Stack:** Next.js 16, React 19, TypeScript, `pg`, `mysql2`, Node `node:test`, ESLint

---

## File Structure

### New files

- `lib/database-url.ts`
  Responsibility: Parse `DATABASE_URL`, detect `postgres` vs `mysql`, and normalize connection metadata for the driver layer.
- `lib/sql-dialect.ts`
  Responsibility: Centralize dialect-aware SQL fragments, placeholder generation, table names, and reusable log metric expressions.
- `scripts/test-db-support.ts`
  Responsibility: Run lightweight Node tests without introducing a full test framework.
- `tests/database-url.test.ts`
  Responsibility: Verify URL parsing and dialect detection for PostgreSQL and the `user:pass@tcp(host:port)/db` MySQL DSN.
- `tests/sql-dialect.test.ts`
  Responsibility: Verify SQL helper output for table names, placeholders, casts, and JSON expressions.
- `docs/superpowers/plans/2026-04-19-mysql-runtime-support.md`
  Responsibility: This implementation plan.

### Modified files

- `package.json`
  Responsibility: Add the MySQL driver dependency and a lightweight `test` script for the Node-based checks.
- `lib/env.ts`
  Responsibility: Keep env validation focused on reading `DATABASE_URL`, but delegate URL semantics to the parser layer if needed.
- `lib/db.ts`
  Responsibility: Create the correct pool for PostgreSQL or MySQL and normalize query results to `{ rows }`.
- `lib/logs-sql.ts`
  Responsibility: Either become a thin compatibility wrapper or be replaced by `lib/sql-dialect.ts` exports for metric expressions.
- `app/api/filters/route.ts`
  Responsibility: Replace hardcoded PostgreSQL table names with dialect-aware references.
- `app/api/logs/route.ts`
  Responsibility: Replace PostgreSQL-specific table names, casts, and JSON SQL with dialect-aware helpers.
- `app/api/stats/summary/route.ts`
  Responsibility: Use dialect-aware metric expressions and filter expressions.
- `app/api/stats/models/route.ts`
  Responsibility: Use dialect-aware metric expressions and filter expressions.
- `app/api/stats/users/route.ts`
  Responsibility: Use dialect-aware metric expressions and filter expressions.
- `app/api/stats/time-series/route.ts`
  Responsibility: Use dialect-aware filter expressions while keeping the hourly bucketing behavior stable.
- `README.md`
  Responsibility: Document that `DATABASE_URL` now supports PostgreSQL and MySQL runtime detection.

## Task 1: Add Lightweight Test Entry Point

**Files:**
- Create: `scripts/test-db-support.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test runner script**

```ts
import { glob } from 'node:fs/promises';
import { run } from 'node:test';
import process from 'node:process';

const testFiles: string[] = [];

for await (const file of glob('tests/**/*.test.ts')) {
  testFiles.push(file);
}

if (testFiles.length === 0) {
  console.error('No test files found.');
  process.exit(1);
}

const stream = run({
  concurrency: false,
  files: testFiles,
});

stream.on('test:fail', () => {
  process.exitCode = 1;
});
```

- [ ] **Step 2: Wire the script into `package.json`**

```json
{
  "scripts": {
    "test": "node --experimental-strip-types scripts/test-db-support.ts"
  }
}
```

- [ ] **Step 3: Run the test command to verify it fails**

Run: `pnpm test`
Expected: FAIL with `No test files found.`

- [ ] **Step 4: Commit**

```bash
git add package.json scripts/test-db-support.ts
git commit -m "test: add lightweight db support test runner"
```

## Task 2: Add Failing Coverage for URL Parsing

**Files:**
- Create: `tests/database-url.test.ts`
- Test: `tests/database-url.test.ts`

- [ ] **Step 1: Write the failing parser tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { parseDatabaseUrl } from '@/lib/database-url';

test('parseDatabaseUrl detects postgres URLs', () => {
  const parsed = parseDatabaseUrl('postgresql://demo:secret@localhost:5432/newapi');

  assert.equal(parsed.dialect, 'postgres');
  assert.equal(parsed.connectionString, 'postgresql://demo:secret@localhost:5432/newapi');
});

test('parseDatabaseUrl detects mysql tcp DSNs', () => {
  const parsed = parseDatabaseUrl('demo:secret@tcp(db.example.com:3306)/newapi');

  assert.equal(parsed.dialect, 'mysql');
  assert.deepEqual(parsed.connection, {
    database: 'newapi',
    host: 'db.example.com',
    password: 'secret',
    port: 3306,
    user: 'demo',
  });
});

test('parseDatabaseUrl rejects unsupported DSNs', () => {
  assert.throws(
    () => parseDatabaseUrl('sqlite:///tmp/demo.db'),
    /Unsupported DATABASE_URL format/,
  );
});
```

- [ ] **Step 2: Run the parser tests to verify they fail**

Run: `pnpm test`
Expected: FAIL with `Cannot find module '@/lib/database-url'` or equivalent import error.

- [ ] **Step 3: Commit**

```bash
git add tests/database-url.test.ts
git commit -m "test: cover database url parsing"
```

## Task 3: Implement URL Parsing

**Files:**
- Create: `lib/database-url.ts`
- Modify: `lib/env.ts`
- Test: `tests/database-url.test.ts`

- [ ] **Step 1: Write the parser implementation**

```ts
export type DatabaseDialect = 'mysql' | 'postgres';

type ParsedMySqlConnection = {
  database: string;
  host: string;
  password: string;
  port: number;
  user: string;
};

type ParsedDatabaseUrl =
  | {
      connectionString: string;
      dialect: 'postgres';
    }
  | {
      connection: ParsedMySqlConnection;
      dialect: 'mysql';
    };

const MYSQL_TCP_DSN_REGEX = /^([^:]+):([^@]+)@tcp\(([^:]+):(\d+)\)\/([^?]+)(?:\?.*)?$/;

export const parseDatabaseUrl = (databaseUrl: string): ParsedDatabaseUrl => {
  if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
    return {
      connectionString: databaseUrl,
      dialect: 'postgres',
    };
  }

  if (databaseUrl.startsWith('mysql://')) {
    const url = new URL(databaseUrl);

    return {
      connection: {
        database: url.pathname.replace(/^\//, ''),
        host: url.hostname,
        password: decodeURIComponent(url.password),
        port: url.port ? parseInt(url.port, 10) : 3306,
        user: decodeURIComponent(url.username),
      },
      dialect: 'mysql',
    };
  }

  const match = databaseUrl.match(MYSQL_TCP_DSN_REGEX);
  if (match) {
    const [, user, password, host, port, database] = match;

    return {
      connection: {
        database,
        host,
        password,
        port: parseInt(port, 10),
        user,
      },
      dialect: 'mysql',
    };
  }

  throw new Error('Unsupported DATABASE_URL format');
};
```

- [ ] **Step 2: Update env access to use the parser-compatible string validation**

```ts
const databaseUrlSchema = z.string().min(1, 'DATABASE_URL is required');
```

- [ ] **Step 3: Run the parser tests to verify they pass**

Run: `pnpm test`
Expected: PASS for all `database-url` tests and FAIL for any not-yet-implemented dialect tests added later.

- [ ] **Step 4: Commit**

```bash
git add lib/database-url.ts lib/env.ts tests/database-url.test.ts
git commit -m "feat: parse postgres and mysql database urls"
```

## Task 4: Add Failing Coverage for SQL Dialect Helpers

**Files:**
- Create: `tests/sql-dialect.test.ts`
- Test: `tests/sql-dialect.test.ts`

- [ ] **Step 1: Write the failing SQL helper tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSqlContext,
  getCacheTokensSql,
  getInputTokensSql,
  getLogsTableName,
  getTextCastSql,
} from '@/lib/sql-dialect';

test('createSqlContext builds postgres placeholders', () => {
  const context = createSqlContext('postgres');

  assert.equal(context.addParam(123), '$1');
  assert.equal(context.addParam('abc'), '$2');
  assert.deepEqual(context.params, [123, 'abc']);
});

test('createSqlContext builds mysql placeholders', () => {
  const context = createSqlContext('mysql');

  assert.equal(context.addParam(123), '?');
  assert.equal(context.addParam('abc'), '?');
  assert.deepEqual(context.params, [123, 'abc']);
});

test('dialect helpers switch table names and casts', () => {
  assert.equal(getLogsTableName('postgres'), 'public.logs');
  assert.equal(getLogsTableName('mysql'), 'logs');
  assert.equal(getTextCastSql('postgres', 'l.user_id'), 'l.user_id::text');
  assert.equal(getTextCastSql('mysql', 'l.user_id'), 'CAST(l.user_id AS CHAR)');
});

test('metric SQL stays dialect aware', () => {
  assert.match(getCacheTokensSql('postgres', 'l.other'), /other::json/);
  assert.match(getCacheTokensSql('mysql', 'l.other'), /JSON_EXTRACT/);
  assert.match(getInputTokensSql('mysql', 'l.prompt_tokens', 'l.other'), /Claude Messages/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test`
Expected: FAIL with `Cannot find module '@/lib/sql-dialect'` or missing export errors.

- [ ] **Step 3: Commit**

```bash
git add tests/sql-dialect.test.ts
git commit -m "test: cover sql dialect helpers"
```

## Task 5: Implement SQL Dialect Helpers

**Files:**
- Create: `lib/sql-dialect.ts`
- Modify: `lib/logs-sql.ts`
- Test: `tests/sql-dialect.test.ts`

- [ ] **Step 1: Implement the SQL helper module**

```ts
import type { DatabaseDialect } from '@/lib/database-url';

export type QueryParam = boolean | null | number | string;

type SqlContext = {
  addParam: (value: QueryParam) => string;
  params: QueryParam[];
};

export const createSqlContext = (dialect: DatabaseDialect): SqlContext => {
  const params: QueryParam[] = [];

  return {
    addParam: (value) => {
      params.push(value);
      return dialect === 'postgres' ? `$${params.length}` : '?';
    },
    params,
  };
};

export const getLogsTableName = (dialect: DatabaseDialect) =>
  dialect === 'postgres' ? 'public.logs' : 'logs';

export const getChannelsTableName = (dialect: DatabaseDialect) =>
  dialect === 'postgres' ? 'public.channels' : 'channels';

export const getTextCastSql = (dialect: DatabaseDialect, column: string) =>
  dialect === 'postgres' ? `${column}::text` : `CAST(${column} AS CHAR)`;

export const getCacheTokensSql = (dialect: DatabaseDialect, otherColumn: string) =>
  dialect === 'postgres'
    ? `
      CASE
        WHEN ${otherColumn} IS NOT NULL AND ${otherColumn} <> '' AND ${otherColumn} ~ '^\\\\s*\\\\{'
        THEN COALESCE((${otherColumn}::json ->> 'cache_tokens')::bigint, 0)
        ELSE 0
      END
    `
    : `
      CASE
        WHEN ${otherColumn} IS NOT NULL AND ${otherColumn} <> '' AND JSON_VALID(${otherColumn})
        THEN COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(${otherColumn}, '$.cache_tokens')) AS SIGNED), 0)
        ELSE 0
      END
    `;

export const getInputTokensSql = (
  dialect: DatabaseDialect,
  promptTokensColumn: string,
  otherColumn: string,
) => `
  COALESCE(${promptTokensColumn}, 0) +
  CASE
    WHEN ${
      dialect === 'postgres'
        ? `${otherColumn} IS NOT NULL AND ${otherColumn} <> '' AND ${otherColumn} ~ '"request_conversion"\\\\s*:\\\\s*\\\\[[^\\\\]]*"Claude Messages"'`
        : `${otherColumn} IS NOT NULL AND ${otherColumn} <> '' AND JSON_VALID(${otherColumn}) AND JSON_SEARCH(JSON_EXTRACT(${otherColumn}, '$.request_conversion'), 'one', 'Claude Messages') IS NOT NULL`
    }
    THEN ${getCacheTokensSql(dialect, otherColumn)}
    ELSE 0
  END
`;
```

- [ ] **Step 2: Keep `lib/logs-sql.ts` as a compatibility re-export**

```ts
export {
  getCacheTokensSql,
  getInputTokensSql,
} from '@/lib/sql-dialect';
```

- [ ] **Step 3: Run the SQL helper tests to verify they pass**

Run: `pnpm test`
Expected: PASS for `database-url` and `sql-dialect` tests.

- [ ] **Step 4: Commit**

```bash
git add lib/sql-dialect.ts lib/logs-sql.ts tests/sql-dialect.test.ts
git commit -m "feat: add dialect-aware sql helpers"
```

## Task 6: Implement Dual-Driver Database Access

**Files:**
- Modify: `package.json`
- Modify: `lib/db.ts`
- Modify: `lib/database-url.ts`
- Test: `tests/database-url.test.ts`

- [ ] **Step 1: Add the MySQL driver dependency**

```json
{
  "dependencies": {
    "mysql2": "^3.12.0"
  }
}
```

- [ ] **Step 2: Implement normalized dual-driver query access**

```ts
import mysql from 'mysql2/promise';
import { Pool } from 'pg';

import { getDatabaseUrl } from '@/lib/env';
import { parseDatabaseUrl } from '@/lib/database-url';

type QueryParam = boolean | null | number | string;
type QueryResultRow = Record<string, unknown>;
type QueryResult = { rows: QueryResultRow[] };

let pgPool: Pool | null = null;
let mysqlPool: mysql.Pool | null = null;

const getQueryEngine = () => {
  const parsed = parseDatabaseUrl(getDatabaseUrl());

  if (parsed.dialect === 'postgres') {
    if (!pgPool) {
      pgPool = new Pool({
        connectionString: parsed.connectionString,
      });
    }

    return {
      dialect: parsed.dialect,
      query: async (text: string, params: QueryParam[] = []): Promise<QueryResult> => {
        const result = await pgPool!.query(text, params);
        return { rows: result.rows as QueryResultRow[] };
      },
    };
  }

  if (!mysqlPool) {
    mysqlPool = mysql.createPool(parsed.connection);
  }

  return {
    dialect: parsed.dialect,
    query: async (text: string, params: QueryParam[] = []): Promise<QueryResult> => {
      const [rows] = await mysqlPool!.query(text, params);
      return { rows: rows as QueryResultRow[] };
    },
  };
};

export const getDatabaseDialect = () => getQueryEngine().dialect;

export const query = (text: string, params?: QueryParam[]) =>
  getQueryEngine().query(text, params);
```

- [ ] **Step 3: Add parser validation for empty MySQL path segments if missing**

```ts
if (!database) {
  throw new Error('Unsupported DATABASE_URL format');
}
```

- [ ] **Step 4: Run the tests to verify the helper layer still passes**

Run: `pnpm test`
Expected: PASS for all current tests.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml lib/db.ts lib/database-url.ts
git commit -m "feat: add mysql driver support"
```

## Task 7: Refactor Filters and Shared Route Query Building

**Files:**
- Modify: `app/api/filters/route.ts`
- Modify: `lib/sql-dialect.ts`

- [ ] **Step 1: Add route-friendly helper exports if needed**

```ts
export const buildEqualityOrTextCastCondition = (
  dialect: DatabaseDialect,
  column: string,
  castColumn: string,
  placeholder: string,
) => `(${column} = ${placeholder} OR ${getTextCastSql(dialect, castColumn)} = ${placeholder})`;
```

- [ ] **Step 2: Update the filters route to use dialect-aware table names**

```ts
const dialect = getDatabaseDialect();
const logsTable = getLogsTableName(dialect);

const usersQuery = `
  SELECT DISTINCT username
  FROM ${logsTable}
  WHERE username IS NOT NULL AND username <> ''
  ORDER BY username
  LIMIT 100
`;
```

- [ ] **Step 3: Run static checks**

Run: `pnpm lint app/api/filters/route.ts lib/sql-dialect.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/api/filters/route.ts lib/sql-dialect.ts
git commit -m "refactor: make filters route dialect aware"
```

## Task 8: Refactor Logs Route

**Files:**
- Modify: `app/api/logs/route.ts`
- Modify: `lib/sql-dialect.ts`

- [ ] **Step 1: Switch the route to `createSqlContext`**

```ts
const dialect = getDatabaseDialect();
const sql = createSqlContext(dialect);

if (startTime) {
  conditions.push(`l.created_at >= ${sql.addParam(parseInt(startTime, 10))}`);
}
```

- [ ] **Step 2: Replace PostgreSQL-specific fragments**

```ts
const logsTable = getLogsTableName(dialect);
const channelsTable = getChannelsTableName(dialect);
const cacheTokensSql = getCacheTokensSql(dialect, 'l.other');
const inputTokensSql = getInputTokensSql(dialect, 'l.prompt_tokens', 'l.other');
const firstTokenTimeSql = getFirstTokenTimeSql(dialect, 'l.other');
```

- [ ] **Step 3: Update query execution to use `sql.params`**

```ts
const countResult = await query(countQuery, sql.params);
```

- [ ] **Step 4: Run lint and type-check for the route**

Run: `pnpm lint app/api/logs/route.ts lib/sql-dialect.ts`
Expected: PASS

Run: `pnpm type-check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/logs/route.ts lib/sql-dialect.ts
git commit -m "refactor: make logs route dialect aware"
```

## Task 9: Refactor Summary, Model, User, and Time-Series Routes

**Files:**
- Modify: `app/api/stats/summary/route.ts`
- Modify: `app/api/stats/models/route.ts`
- Modify: `app/api/stats/users/route.ts`
- Modify: `app/api/stats/time-series/route.ts`
- Modify: `lib/sql-dialect.ts`

- [ ] **Step 1: Apply the shared SQL context pattern to each route**

```ts
const dialect = getDatabaseDialect();
const sql = createSqlContext(dialect);
const logsTable = getLogsTableName(dialect);
```

- [ ] **Step 2: Replace cast comparisons and metric expressions**

```ts
conditions.push(
  buildEqualityOrTextCastCondition(
    dialect,
    'channel_name',
    'channel_id',
    sql.addParam(channel),
  ),
);
```

- [ ] **Step 3: Keep the time-bucket expression stable**

```ts
const hourBucketSql = '(created_at / 3600) * 3600';
```

- [ ] **Step 4: Run lint and type-check for the updated routes**

Run: `pnpm lint app/api/stats/summary/route.ts app/api/stats/models/route.ts app/api/stats/users/route.ts app/api/stats/time-series/route.ts`
Expected: PASS

Run: `pnpm type-check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/stats/summary/route.ts app/api/stats/models/route.ts app/api/stats/users/route.ts app/api/stats/time-series/route.ts lib/sql-dialect.ts
git commit -m "refactor: make stats routes dialect aware"
```

## Task 10: Document and Verify End-to-End

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README database section**

```md
* `DATABASE_URL`: 指向你的 new-api 数据库，支持 PostgreSQL URL，也支持 MySQL 连接串；程序会在运行时自动识别。
```

- [ ] **Step 2: Run the lightweight tests and static checks**

Run: `pnpm test`
Expected: PASS

Run: `pnpm lint`
Expected: PASS

Run: `pnpm type-check`
Expected: PASS

- [ ] **Step 3: Manually verify the MySQL routes without printing secrets**

Run:

```bash
env $(node - <<'NODE'
const fs = require('fs');
const content = fs.readFileSync('.env_mysql', 'utf8');
const line = content.split(/\r?\n/).find((entry) => entry.startsWith('DATABASE_URL='));
process.stdout.write(line);
NODE
) DASHBOARD_PASSWORD=demo SESSION_SECRET=demo pnpm dev
```

Expected: App starts, login works, and the following endpoints return `200` after authentication:

- `/api/filters`
- `/api/logs`
- `/api/stats/summary`
- `/api/stats/models`
- `/api/stats/users`
- `/api/stats/time-series`

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: describe mysql runtime support"
```

## Self-Review

Spec coverage check:

- Runtime dialect detection is covered by Tasks 2, 3, and 6.
- SQL compatibility helpers are covered by Tasks 4, 5, 7, 8, and 9.
- Route compatibility is covered by Tasks 7, 8, and 9.
- Verification for lint, type-check, and MySQL manual checks is covered by Task 10.
- README documentation is covered by Task 10.

Placeholder scan:

- No `TODO`, `TBD`, or “similar to Task N” placeholders remain.
- Each code-changing task includes exact file paths, code snippets, commands, and expected outcomes.

Type consistency check:

- `parseDatabaseUrl`, `createSqlContext`, `getDatabaseDialect`, `getLogsTableName`, `getChannelsTableName`, `getTextCastSql`, `getCacheTokensSql`, and `getInputTokensSql` are named consistently across the plan.
- Query results are consistently normalized to `{ rows }`.
