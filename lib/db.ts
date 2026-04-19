import { createPool } from 'mysql2/promise';
import { Pool } from 'pg';

import { parseDatabaseUrl } from '@/lib/database-url';
import { getDatabaseUrl } from '@/lib/env';

import type { Pool as MySqlPool, RowDataPacket } from 'mysql2/promise';

type QueryParam = boolean | null | number | string;
// Existing route handlers still rely on loosely typed rows until dialect-specific refactors land.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LegacyQueryRow = any;
type QueryResult<TRow = LegacyQueryRow> = {
  rows: TRow[];
};
type PostgresPoolState = {
  connectionString: string;
  pool: Pool;
};
type MySqlPoolState = {
  key: string;
  pool: MySqlPool;
};

const MYSQL_POSTGRES_SQL_GUARD_MESSAGE =
  'MySQL runtime does not support Postgres-specific SQL yet. Refactor this query before using a MySQL DATABASE_URL.';
const POSTGRES_CAST_PATTERN = /::[a-zA-Z_][a-zA-Z0-9_\[\]]*/;
const POSTGRES_PLACEHOLDER_PATTERN = /\$\d+\b/;
const POSTGRES_SCHEMA_PATTERN = /\bpublic\./i;

let postgresPoolState: PostgresPoolState | null = null;
let mysqlPoolState: MySqlPoolState | null = null;

const getDatabaseConfig = () => parseDatabaseUrl(getDatabaseUrl());

const getPostgresPool = (databaseConfig: ReturnType<typeof getDatabaseConfig>) => {
  if (databaseConfig.dialect !== 'postgres') {
    throw new Error('Postgres pool requested for a non-Postgres DATABASE_URL.');
  }

  if (!postgresPoolState || postgresPoolState.connectionString !== databaseConfig.connectionString) {
    postgresPoolState = {
      connectionString: databaseConfig.connectionString,
      pool: new Pool({
        connectionString: databaseConfig.connectionString,
      }),
    };
  }

  return postgresPoolState.pool;
};

const getMySqlPool = (databaseConfig: ReturnType<typeof getDatabaseConfig>) => {
  if (databaseConfig.dialect !== 'mysql') {
    throw new Error('MySQL pool requested for a non-MySQL DATABASE_URL.');
  }

  const connectionKey = JSON.stringify(databaseConfig.connection);

  if (!mysqlPoolState || mysqlPoolState.key !== connectionKey) {
    mysqlPoolState = {
      key: connectionKey,
      pool: createPool(databaseConfig.connection),
    };
  }

  return mysqlPoolState.pool;
};

const assertMySqlCompatibleSql = (text: string) => {
  if (
    POSTGRES_PLACEHOLDER_PATTERN.test(text)
    || POSTGRES_CAST_PATTERN.test(text)
    || POSTGRES_SCHEMA_PATTERN.test(text)
  ) {
    throw new Error(`${MYSQL_POSTGRES_SQL_GUARD_MESSAGE} Query snippet: ${text.slice(0, 160)}`);
  }
};

const normalizeMySqlRows = <TRow = LegacyQueryRow>(rows: RowDataPacket[] | RowDataPacket[][]): QueryResult<TRow> => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { rows: [] };
  }

  if (Array.isArray(rows[0])) {
    return {
      rows: rows.flat() as TRow[],
    };
  }

  return {
    rows: rows as TRow[],
  };
};

export const getDatabaseDialect = () => getDatabaseConfig().dialect;

export async function query<TRow = LegacyQueryRow>(
  text: string,
  params?: QueryParam[],
): Promise<QueryResult<TRow>> {
  const databaseConfig = getDatabaseConfig();

  if (databaseConfig.dialect === 'postgres') {
    const client = await getPostgresPool(databaseConfig).connect();

    try {
      const result = await client.query(text, params);

      return {
        rows: result.rows as TRow[],
      };
    } finally {
      client.release();
    }
  }

  assertMySqlCompatibleSql(text);

  const [rows] = await getMySqlPool(databaseConfig).execute<RowDataPacket[]>(text, params ?? []);

  return normalizeMySqlRows<TRow>(rows);
}

const db = { query };

export default db;
