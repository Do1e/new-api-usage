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

const databaseConfig = parseDatabaseUrl(getDatabaseUrl());

let postgresPool: Pool | null = null;
let mysqlPool: MySqlPool | null = null;

const getPostgresConfig = () => {
  if (databaseConfig.dialect !== 'postgres') {
    throw new Error('Postgres config requested for a non-Postgres DATABASE_URL.');
  }

  return databaseConfig;
};

const getMySqlConfig = () => {
  if (databaseConfig.dialect !== 'mysql') {
    throw new Error('MySQL config requested for a non-MySQL DATABASE_URL.');
  }

  return databaseConfig;
};

const getPostgresPool = () => {
  if (!postgresPool) {
    postgresPool = new Pool({
      connectionString: getPostgresConfig().connectionString,
    });
  }

  return postgresPool;
};

const getMySqlPool = () => {
  if (!mysqlPool) {
    mysqlPool = createPool(getMySqlConfig().connection);
  }

  return mysqlPool;
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

export const getDatabaseDialect = () => databaseConfig.dialect;

export async function query<TRow = LegacyQueryRow>(
  text: string,
  params?: QueryParam[],
): Promise<QueryResult<TRow>> {
  if (databaseConfig.dialect === 'postgres') {
    const client = await getPostgresPool().connect();

    try {
      const result = await client.query(text, params);

      return {
        rows: result.rows as TRow[],
      };
    } finally {
      client.release();
    }
  }

  const [rows] = await getMySqlPool().execute<RowDataPacket[]>(text, params ?? []);

  return normalizeMySqlRows<TRow>(rows);
}

const db = { query };

export default db;
