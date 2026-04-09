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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const user = searchParams.get('user');
    const model = searchParams.get('model');
    const token = searchParams.get('token');
    const channel = searchParams.get('channel');

    // Build WHERE clause
    const conditions: string[] = [];
    const params: (string | number | null)[] = [];
    let paramIndex = 1;

    if (startTime) {
      conditions.push(`l.created_at >= $${paramIndex}`);
      params.push(parseInt(startTime));
      paramIndex++;
    }

    if (endTime) {
      conditions.push(`l.created_at <= $${paramIndex}`);
      params.push(parseInt(endTime));
      paramIndex++;
    }

    if (user) {
      conditions.push(`(l.username = $${paramIndex} OR l.user_id::text = $${paramIndex})`);
      params.push(user);
      paramIndex++;
    }

    if (model) {
      conditions.push(`l.model_name = $${paramIndex}`);
      params.push(model);
      paramIndex++;
    }

    if (token) {
      conditions.push(`l.token_name = $${paramIndex}`);
      params.push(token);
      paramIndex++;
    }

    if (channel) {
      conditions.push(`(l.channel_name = $${paramIndex} OR l.channel_id::text = $${paramIndex})`);
      params.push(channel);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const aliasedCacheTokensSql = CACHE_TOKENS_SQL.replaceAll('other', 'l.other');
    const aliasedInputTokensSql = INPUT_TOKENS_SQL
      .replaceAll('other', 'l.other')
      .replaceAll('prompt_tokens', 'l.prompt_tokens');

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM public.logs l ${whereClause}`;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated logs
    const offset = (page - 1) * limit;
    const logsQuery = `
      SELECT 
        l.id,
        l.created_at,
        l.username,
        l.model_name,
        l.token_name,
        COALESCE(l.channel_name, c.name) as channel_name,
        l.is_stream,
        l.use_time,
        ${aliasedInputTokensSql} as input_tokens,
        l.completion_tokens as output_tokens,
        ${aliasedCacheTokensSql} as cache_tokens,
        CASE
          WHEN l.other IS NOT NULL
           AND l.other <> ''
           AND l.other ~ '^\\s*\\{'
          THEN COALESCE((l.other::json ->> 'frt')::bigint, 0)
          ELSE 0
        END as first_token_time
      FROM public.logs l
      LEFT JOIN public.channels c ON l.channel_id::integer = c.id
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(limit, offset);

    const logsResult = await query(logsQuery, params);

    const logs = logsResult.rows.map((row: { 
      id: number; 
      created_at: number; 
      username: string; 
      model_name: string; 
      token_name: string | null;
      channel_name: string; 
      is_stream: boolean;
      use_time: number; 
      input_tokens: number; 
      output_tokens: number; 
      cache_tokens: number; 
      first_token_time: number; 
    }) => ({
      id: row.id,
      time: row.created_at,
      timeFormatted: new Date(row.created_at * 1000).toLocaleString('zh-CN'),
      user: row.username || 'Unknown',
      model: row.model_name || 'Unknown',
      tokenName: row.token_name || '',
      channel: row.channel_name || 'Unknown',
      isStream: row.is_stream,
      useTime: row.use_time || 0,
      inputTokens: row.input_tokens || 0,
      outputTokens: row.output_tokens || 0,
      cacheTokens: row.cache_tokens || 0,
      firstTokenTime: row.first_token_time || 0,
    }));

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('Logs API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
