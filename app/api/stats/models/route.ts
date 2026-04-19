import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { jwtVerify } from 'jose';

import { getDatabaseDialect, query } from '@/lib/db';
import { getSessionSecret } from '@/lib/env';
import {
  buildEqualityOrTextCastCondition,
  createSqlContext,
  getCacheTokensSql,
  getInputTokensSql,
  getLogsTableName,
} from '@/lib/sql-dialect';

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
    const token = searchParams.get('token');
    const channel = searchParams.get('channel');

    let startTimeTs: number | null = null;
    let endTimeTs: number | null = null;

    if (startTime) {
      const parsedStartTime = parseInt(startTime, 10);
      if (!Number.isFinite(parsedStartTime) || parsedStartTime < 0) {
        return NextResponse.json(
          { error: 'Invalid startTime' },
          { status: 400 }
        );
      }
      startTimeTs = parsedStartTime;
    }

    if (endTime) {
      const parsedEndTime = parseInt(endTime, 10);
      if (!Number.isFinite(parsedEndTime) || parsedEndTime < 0) {
        return NextResponse.json(
          { error: 'Invalid endTime' },
          { status: 400 }
        );
      }
      endTimeTs = parsedEndTime;
    }

    const dialect = getDatabaseDialect();
    const sql = createSqlContext(dialect);
    const logsTableName = getLogsTableName(dialect);
    const cacheTokensSql = getCacheTokensSql(dialect, 'other');
    const inputTokensSql = getInputTokensSql(dialect, 'prompt_tokens', 'other');

    // Build WHERE clause
    const conditions: string[] = [];

    if (startTimeTs !== null) {
      conditions.push(`created_at >= ${sql.addParam(startTimeTs)}`);
    }

    if (endTimeTs !== null) {
      conditions.push(`created_at <= ${sql.addParam(endTimeTs)}`);
    }

    if (user) {
      conditions.push(buildEqualityOrTextCastCondition(dialect, sql, 'username', 'user_id', user));
    }

    if (token) {
      conditions.push(`token_name = ${sql.addParam(token)}`);
    }

    if (channel) {
      conditions.push(buildEqualityOrTextCastCondition(dialect, sql, 'channel_name', 'channel_id', channel));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get model statistics
    const modelQuery = `
      SELECT 
        COALESCE(model_name, 'Unknown') as model,
        COUNT(*) as calls,
        COALESCE(SUM(${inputTokensSql}), 0) as input_tokens,
        COALESCE(SUM(completion_tokens), 0) as output_tokens,
        COALESCE(SUM(${cacheTokensSql}), 0) as cache_tokens
      FROM ${logsTableName}
      ${whereClause}
      GROUP BY model_name
      ORDER BY calls DESC
    `;

    const result = await query(modelQuery, sql.params);

    const data = result.rows.map((row: { model: string; calls: string; input_tokens: string; output_tokens: string; cache_tokens: string }) => ({
      model: row.model,
      calls: parseInt(row.calls),
      inputTokens: parseInt(row.input_tokens),
      outputTokens: parseInt(row.output_tokens),
      cacheTokens: parseInt(row.cache_tokens),
      totalTokens: parseInt(row.input_tokens) + parseInt(row.output_tokens),
    }));

    return NextResponse.json({ data });

  } catch (error) {
    console.error('Model stats API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
