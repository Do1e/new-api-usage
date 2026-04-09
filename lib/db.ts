import { Pool } from 'pg';

import { getDatabaseUrl } from '@/lib/env';

// Create a connection pool
const pool = new Pool({
  connectionString: getDatabaseUrl(),
});

export async function query(text: string, params?: (string | number | boolean | null)[]) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

export default pool;
