import { Pool } from 'pg';

import { getDatabaseUrl } from '@/lib/env';

let pool: Pool | null = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
    });
  }
  return pool;
}

export async function query(text: string, params?: (string | number | boolean | null)[]) {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

const db = { query };

export default db;
