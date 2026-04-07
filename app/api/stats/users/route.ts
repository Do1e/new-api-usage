import { cookies } from 'next/headers';
import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';

import { jwtVerify } from 'jose';

import { query } from '@/lib/db';
import { CACHE_TOKENS_SQL, INPUT_TOKENS_SQL } from '@/lib/logs-sql';

const SESSION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-in-production';

// Verify authentication
async function verifyAuth(_request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  
  if (!token) {
    return false;
  }
  
  try {
    await jwtVerify(token, new TextEncoder().encode(SESSION_SECRET));
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const isAuthenticated = await verifyAuth(request);
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = request.nextUrl;
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const model = searchParams.get('model');
    const token = searchParams.get('token');
    const channel = searchParams.get('channel');

    // Build WHERE clause
    const conditions: string[] = [];
    const params: (string | number | null)[] = [];
    let paramIndex = 1;

    if (startTime) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(parseInt(startTime));
      paramIndex++;
    }

    if (endTime) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(parseInt(endTime));
      paramIndex++;
    }

    if (model) {
      conditions.push(`model_name = $${paramIndex}`);
      params.push(model);
      paramIndex++;
    }

    if (token) {
      conditions.push(`token_name = $${paramIndex}`);
      params.push(token);
      paramIndex++;
    }

    if (channel) {
      conditions.push(`(channel_name = $${paramIndex} OR channel_id::text = $${paramIndex})`);
      params.push(channel);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get user statistics
    const userQuery = `
      SELECT 
        COALESCE(username, 'Unknown') as username,
        COUNT(*) as calls,
        COALESCE(SUM(${INPUT_TOKENS_SQL}), 0) as input_tokens,
        COALESCE(SUM(completion_tokens), 0) as output_tokens,
        COALESCE(SUM(${CACHE_TOKENS_SQL}), 0) as cache_tokens
      FROM public.logs
      ${whereClause}
      GROUP BY username
      ORDER BY calls DESC
    `;

    const result = await query(userQuery, params);

    const data = result.rows.map((row: { username: string; calls: string; input_tokens: string; output_tokens: string; cache_tokens: string }) => ({
      username: row.username,
      calls: parseInt(row.calls),
      inputTokens: parseInt(row.input_tokens),
      outputTokens: parseInt(row.output_tokens),
      cacheTokens: parseInt(row.cache_tokens),
      totalTokens: parseInt(row.input_tokens) + parseInt(row.output_tokens),
    }));

    return NextResponse.json({ data });

  } catch (error) {
    console.error('User stats API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
