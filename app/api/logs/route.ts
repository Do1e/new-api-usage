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
  getChannelsTableName,
  getFirstTokenTimeSql,
  getInputTokensSql,
  getLogsTableName,
  getTextCastSql,
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const user = searchParams.get('user');
    const model = searchParams.get('model');
    const token = searchParams.get('token');
    const channel = searchParams.get('channel');

    const dialect = getDatabaseDialect();
    const sql = createSqlContext(dialect);
    const logsTableName = getLogsTableName(dialect);
    const channelsTableName = getChannelsTableName(dialect);

    // Build WHERE clause
    const conditions: string[] = [];

    if (startTime) {
      conditions.push(`l.created_at >= ${sql.addParam(parseInt(startTime, 10))}`);
    }

    if (endTime) {
      conditions.push(`l.created_at <= ${sql.addParam(parseInt(endTime, 10))}`);
    }

    if (user) {
      const placeholder = sql.addParam(user);
      conditions.push(buildEqualityOrTextCastCondition(dialect, 'l.username', 'l.user_id', placeholder));
    }

    if (model) {
      conditions.push(`l.model_name = ${sql.addParam(model)}`);
    }

    if (token) {
      conditions.push(`l.token_name = ${sql.addParam(token)}`);
    }

    if (channel) {
      const placeholder = sql.addParam(channel);
      conditions.push(buildEqualityOrTextCastCondition(dialect, 'l.channel_name', 'l.channel_id', placeholder));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const cacheTokensSql = getCacheTokensSql(dialect, 'l.other');
    const inputTokensSql = getInputTokensSql(dialect, 'l.prompt_tokens', 'l.other');
    const firstTokenTimeSql = getFirstTokenTimeSql(dialect, 'l.other');

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM ${logsTableName} l ${whereClause}`;
    const countResult = await query(countQuery, sql.params);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated logs
    const offset = (page - 1) * limit;
    const limitPlaceholder = sql.addParam(limit);
    const offsetPlaceholder = sql.addParam(offset);
    const channelJoinSql = `${getTextCastSql(dialect, 'l.channel_id')} = ${getTextCastSql(dialect, 'c.id')}`;
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
        ${inputTokensSql} as input_tokens,
        l.completion_tokens as output_tokens,
        ${cacheTokensSql} as cache_tokens,
        ${firstTokenTimeSql} as first_token_time
      FROM ${logsTableName} l
      LEFT JOIN ${channelsTableName} c ON ${channelJoinSql}
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `;

    const logsResult = await query(logsQuery, sql.params);

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
