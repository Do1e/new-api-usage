import { cookies } from 'next/headers';
import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';

import { jwtVerify } from 'jose';

import { query } from '@/lib/db';
import { getSessionSecret } from '@/lib/env';
import { CACHE_TOKENS_SQL, INPUT_TOKENS_SQL } from '@/lib/logs-sql';

// Verify authentication
async function verifyAuth(_request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  
  if (!token) {
    return false;
  }
  
  try {
    await jwtVerify(token, new TextEncoder().encode(getSessionSecret()));
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
    const user = searchParams.get('user');
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

    if (user) {
      conditions.push(`(username = $${paramIndex} OR user_id::text = $${paramIndex})`);
      params.push(user);
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

    // Get summary stats
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_calls,
        COALESCE(SUM(${INPUT_TOKENS_SQL}), 0) as input_tokens,
        COALESCE(SUM(completion_tokens), 0) as output_tokens,
        COALESCE(SUM(${CACHE_TOKENS_SQL}), 0) as cache_tokens
      FROM public.logs
      ${whereClause}
    `;

    const summaryResult = await query(summaryQuery, params);
    const stats = summaryResult.rows[0];

    // Calculate total tokens (input + output, cache is part of input)
    const inputTokens = parseInt(stats.input_tokens);
    const outputTokens = parseInt(stats.output_tokens);
    const cacheTokens = parseInt(stats.cache_tokens);
    const totalTokens = inputTokens + outputTokens;

    return NextResponse.json({
      totalCalls: parseInt(stats.total_calls),
      inputTokens,
      outputTokens,
      cacheTokens,
      totalTokens,
    });

  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
