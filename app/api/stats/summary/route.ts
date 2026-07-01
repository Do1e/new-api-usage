import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { jwtVerify } from 'jose';

import { getCostDisplayConfig, quotaToCost } from '@/lib/cost';
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
    const model = searchParams.get('model');
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

    if (model) {
      conditions.push(`model_name = ${sql.addParam(model)}`);
    }

    if (token) {
      conditions.push(`token_name = ${sql.addParam(token)}`);
    }

    if (channel) {
      conditions.push(buildEqualityOrTextCastCondition(dialect, sql, 'channel_name', 'channel_id', channel));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get summary stats
    const summaryQuery = `
      SELECT
        COUNT(*) as total_calls,
        COALESCE(SUM(${inputTokensSql}), 0) as input_tokens,
        COALESCE(SUM(completion_tokens), 0) as output_tokens,
        COALESCE(SUM(${cacheTokensSql}), 0) as cache_tokens,
        COALESCE(SUM(quota), 0) as quota
      FROM ${logsTableName}
      ${whereClause}
    `;

    const summaryResult = await query(summaryQuery, sql.params);
    const stats = summaryResult.rows[0];

    // Calculate total tokens (input + output, cache is part of input)
    const inputTokens = parseInt(stats.input_tokens);
    const outputTokens = parseInt(stats.output_tokens);
    const cacheTokens = parseInt(stats.cache_tokens);
    const totalTokens = inputTokens + outputTokens;
    const costConfig = getCostDisplayConfig();

    return NextResponse.json({
      totalCalls: parseInt(stats.total_calls),
      totalCost: quotaToCost(Number(stats.quota || 0), costConfig.exchangeRate),
      currencySymbol: costConfig.currencySymbol,
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
