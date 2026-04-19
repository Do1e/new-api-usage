import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { jwtVerify } from 'jose';

import { getDatabaseDialect, query } from '@/lib/db';
import { getSessionSecret } from '@/lib/env';
import {
  buildEqualityOrTextCastCondition,
  createSqlContext,
  getCacheTokensSql,
  getHourBucketSql,
  getInputTokensSql,
  getLogsTableName,
} from '@/lib/sql-dialect';

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
    const isAuthenticated = await verifyAuth(request);
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
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
    if (startTime) {
      const parsedStartTime = parseInt(startTime, 10);
      if (!Number.isFinite(parsedStartTime) || parsedStartTime < 0) {
        return NextResponse.json(
          { error: 'Invalid startTime' },
          { status: 400 },
        );
      }
      startTimeTs = parsedStartTime;
    }

    let endTimeTs: number | null = null;
    if (endTime) {
      const parsedEndTime = parseInt(endTime, 10);
      if (!Number.isFinite(parsedEndTime) || parsedEndTime < 0) {
        return NextResponse.json(
          { error: 'Invalid endTime' },
          { status: 400 },
        );
      }
      endTimeTs = parsedEndTime;
    }

    const endTs = endTimeTs ?? Math.floor(Date.now() / 1000);
    let endHour = Math.floor(endTs / 3600) * 3600;
    if (endTs === endHour) {
      endHour -= 3600;
    }
    const startHour = endHour - 71 * 3600;

    const dialect = getDatabaseDialect();
    const sql = createSqlContext(dialect);
    const logsTableName = getLogsTableName(dialect);
    const cacheTokensSql = getCacheTokensSql(dialect, 'other');
    const inputTokensSql = getInputTokensSql(dialect, 'prompt_tokens', 'other');
    const hourBucketSql = getHourBucketSql(dialect, 'created_at');

    const startBound = startTimeTs !== null ? Math.max(startHour, startTimeTs) : startHour;

    const conditions: string[] = [
      `created_at >= ${sql.addParam(startBound)}`,
      `created_at < ${sql.addParam(endHour + 3600)}`,
    ];

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

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const tsQuery = `
      SELECT
        COALESCE(username, 'Unknown') as username,
        ${hourBucketSql} as hour_bucket,
        COUNT(*) as calls,
        COALESCE(SUM(${inputTokensSql}), 0) as input_tokens,
        COALESCE(SUM(completion_tokens), 0) as output_tokens,
        COALESCE(SUM(${cacheTokensSql}), 0) as cache_tokens
      FROM ${logsTableName}
      ${whereClause}
      GROUP BY username, ${hourBucketSql}
      ORDER BY hour_bucket, username
    `;

    const result = await query(tsQuery, sql.params);

    const hourBuckets: number[] = [];
    for (let i = 0; i < 72; i++) {
      hourBuckets.push(startHour + i * 3600);
    }

    const usernames = [...new Set(result.rows.map((r: { username: string }) => r.username))];

    type MetricRow = { username: string; hour_bucket: string; calls: string; input_tokens: string; output_tokens: string; cache_tokens: string };
    const callsMap = new Map<string, number>();
    const inputTokensMap = new Map<string, number>();
    const outputTokensMap = new Map<string, number>();
    const cacheTokensMap = new Map<string, number>();
    for (const row of result.rows as MetricRow[]) {
      const key = `${row.username}-${row.hour_bucket}`;
      callsMap.set(key, parseInt(row.calls));
      inputTokensMap.set(key, parseInt(row.input_tokens));
      outputTokensMap.set(key, parseInt(row.output_tokens));
      cacheTokensMap.set(key, parseInt(row.cache_tokens));
    }

    const buildSeries = (metricMap: Map<string, number>) =>
      hourBuckets.map((hour) => {
        const point: Record<string, number | string> = { time: hour };
        for (const name of usernames) {
          point[name] = metricMap.get(`${name}-${hour}`) || 0;
        }
        return point;
      });

    const buildSeriesFromMaps = (maps: Map<string, number>[]) =>
      hourBuckets.map((hour) => {
        const point: Record<string, number | string> = { time: hour };
        for (const name of usernames) {
          const key = `${name}-${hour}`;
          point[name] = maps.reduce((sum, m) => sum + (m.get(key) || 0), 0);
        }
        return point;
      });

    return NextResponse.json({
      data: buildSeries(callsMap),
      users: usernames,
      tokens: {
        total: buildSeriesFromMaps([inputTokensMap, outputTokensMap]),
        input: buildSeries(inputTokensMap),
        output: buildSeries(outputTokensMap),
        cache: buildSeries(cacheTokensMap),
      },
    });
  } catch (error) {
    console.error('Time series API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
