# MySQL Runtime Support Design

## Context

This dashboard currently reads `process.env.DATABASE_URL` and assumes the value is a PostgreSQL connection string handled by `pg`. The API routes also embed PostgreSQL-specific SQL, including schema-qualified table names, numbered placeholders, `::text` casts, regex operators, and JSON extraction via `::json ->>`.

The target state is to support both PostgreSQL and MySQL at runtime without changing the frontend contract and without reading `.env_mysql` from application code. The process that starts the app remains responsible for injecting `DATABASE_URL` into the environment.

The MySQL instance has been probed in read-only mode. The required tables exist and align with the current API queries:

- `logs`
- `channels`

The expected columns used by this project are present, including `logs.other`, `logs.prompt_tokens`, `logs.completion_tokens`, `logs.user_id`, `logs.channel_id`, and `channels.name`. The `logs.other` column is stored as `longtext`, but the current dataset is overwhelmingly valid JSON and includes the keys required by the dashboard metrics:

- `cache_tokens`
- `frt`
- `request_conversion`

## Goals

- Support PostgreSQL and MySQL from the same codebase.
- Detect the database dialect from `DATABASE_URL` at runtime.
- Preserve existing API responses and frontend behavior.
- Keep environment handling limited to `process.env`.
- Isolate dialect differences in a small, explicit compatibility layer.

## Non-Goals

- No ORM or large query-builder migration.
- No support for arbitrary DSN formats beyond the currently used PostgreSQL URLs and the MySQL DSN shape already in use.
- No changes to authentication, UI behavior, or route structure beyond what is required for database compatibility.
- No automatic loading of `.env_mysql`.

## Recommended Approach

Use a lightweight database dialect layer plus a dual-driver database client.

This keeps the existing route handlers intact while moving the database-specific behavior into a small set of helper functions. It avoids over-engineering the project with a new ORM while still making the supported SQL surface explicit and testable.

## Architecture

### 1. Database URL Parsing and Dialect Detection

Extend the environment/database layer so the app can determine:

- which dialect is in use: `postgres` or `mysql`
- how to connect using the raw `DATABASE_URL`

Supported detection rules:

- `postgres://...` or `postgresql://...` => PostgreSQL
- `mysql://...` => MySQL
- `user:password@tcp(host:3306)/database` => MySQL

The application should continue to read only `process.env.DATABASE_URL`.

### 2. Dual Driver Support

`lib/db.ts` should expose a single `query(sql, params)` API, but internally it should:

- create and cache a `pg.Pool` when the dialect is PostgreSQL
- create and cache a MySQL pool when the dialect is MySQL

The returned result shape should be normalized so existing route handlers can continue to access `result.rows`.

### 3. SQL Dialect Compatibility Layer

Add a small helper module, for example `lib/sql-dialect.ts`, to centralize SQL differences:

- table references
- placeholder generation
- string casting for numeric IDs
- JSON validation and extraction expressions
- reusable metric expressions such as cache tokens, input tokens, and first-token time

The route handlers should use these helpers instead of embedding PostgreSQL-specific fragments directly.

## SQL Compatibility Design

### Table References

PostgreSQL currently uses:

- `public.logs`
- `public.channels`

MySQL should use:

- `logs`
- `channels`

This should be provided by dialect helpers rather than hardcoded in route files.

### Parameter Placeholders

PostgreSQL uses numbered placeholders such as `$1`, `$2`.

MySQL uses positional `?` placeholders.

The compatibility layer should expose a small builder that appends parameters and returns the correct placeholder token for the active dialect. This prevents manual string rewrites and avoids parameter index bugs.

### Text Casting

Current filters rely on PostgreSQL casts such as:

- `user_id::text`
- `channel_id::text`

The dialect layer should provide a helper for “compare numeric ID as text”:

- PostgreSQL: `column::text`
- MySQL: `CAST(column AS CHAR)`

### JSON and Structured Data

Current metrics rely on JSON content stored in `logs.other`. These expressions need dialect-specific implementations.

Required behaviors:

- determine whether `other` is usable JSON
- read `cache_tokens`
- read `frt`
- detect whether `request_conversion` contains `"Claude Messages"`

PostgreSQL implementation can preserve the existing logic.

MySQL implementation should use:

- `JSON_VALID(other)` for validation
- `JSON_EXTRACT(other, '$.cache_tokens')`
- `JSON_EXTRACT(other, '$.frt')`
- `JSON_SEARCH(JSON_EXTRACT(other, '$.request_conversion'), 'one', 'Claude Messages')`

Every MySQL extraction path should guard with `JSON_VALID(other)` before extracting values, so malformed historic rows do not break queries.

### Reusable Metric Expressions

The current `CACHE_TOKENS_SQL` and `INPUT_TOKENS_SQL` should become dialect-aware. The same applies to the first-token-time expression used by the logs route.

The desired semantic behavior remains:

- `cache_tokens`: parsed from `other.cache_tokens`, default `0`
- `input_tokens`: `prompt_tokens + cache_tokens` only when `request_conversion` indicates Claude Messages
- `first_token_time`: parsed from `other.frt`, default `0`

### Time Series Grouping

The existing hourly bucketing expression:

- `(created_at / 3600) * 3600`

is acceptable for both databases and can remain shared if query results are normalized consistently.

## Route Impact

The following routes need SQL compatibility updates:

- `app/api/filters/route.ts`
- `app/api/logs/route.ts`
- `app/api/stats/summary/route.ts`
- `app/api/stats/models/route.ts`
- `app/api/stats/users/route.ts`
- `app/api/stats/time-series/route.ts`

The goal is not to redesign these routes. The goal is to replace embedded PostgreSQL assumptions with calls into the compatibility helpers.

## Error Handling

Database connection or query failures should continue to surface as route-level `500` responses with server-side logging.

Additional validation should be added when parsing `DATABASE_URL`:

- unsupported formats should fail fast with a clear startup error
- missing required MySQL parts should fail fast before the first query

## Verification Strategy

Minimum verification before completion:

- `pnpm lint`
- `pnpm type-check`

Manual API verification against a MySQL-backed runtime:

- `/api/filters`
- `/api/logs`
- `/api/stats/summary`
- `/api/stats/models`
- `/api/stats/users`
- `/api/stats/time-series`

Regression verification against PostgreSQL should confirm the original support remains intact for the same routes.

## Implementation Notes

- Prefer a focused helper API over an abstract query DSL.
- Keep SQL readable inside the routes; only move the truly dialect-specific fragments out.
- Normalize driver results to the shape already expected by the route files.
- Keep the DSN parser and dialect selection logic in one place so it is easy to audit.

## Risks

- Missing one PostgreSQL-specific expression in a route would produce runtime failures only on MySQL.
- MySQL DSN parsing must handle reserved characters carefully if credentials contain special characters.
- If future `newapi` schema changes diverge between PostgreSQL and MySQL, the compatibility layer will need to grow accordingly.

## Decision

Proceed with a runtime auto-detection design backed by a dual-driver `query()` implementation and a focused SQL dialect helper layer. This is the smallest change that preserves the current UI and API contract while making the data access layer explicitly compatible with both supported database engines.
