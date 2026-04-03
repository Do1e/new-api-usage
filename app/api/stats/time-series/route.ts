import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { jwtVerify } from 'jose';

import { query } from '@/lib/db';

const SESSION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-in-production';

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
    const isAuthenticated = await verifyAuth(request);
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const { searchParams } = request.nextUrl;
    const _startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const user = searchParams.get('user');
    const model = searchParams.get('model');
    const channel = searchParams.get('channel');

    const endTs = endTime ? parseInt(endTime) : Math.floor(Date.now() / 1000);
    let endHour = Math.floor(endTs / 3600) * 3600;
    if (endTs === endHour) {
      endHour -= 3600;
    }
    const startHour = endHour - 71 * 3600;

    const conditions: string[] = [
      `created_at >= $1`,
      `created_at < $2`,
    ];
    const params: (string | number)[] = [startHour, endHour + 3600];
    let paramIndex = 3;

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

    if (channel) {
      conditions.push(`(channel_name = $${paramIndex} OR channel_id::text = $${paramIndex})`);
      params.push(channel);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const tsQuery = `
      SELECT
        COALESCE(username, 'Unknown') as username,
        (created_at / 3600) * 3600 as hour_bucket,
        COUNT(*) as calls,
        COALESCE(SUM(prompt_tokens), 0) as input_tokens,
        COALESCE(SUM(completion_tokens), 0) as output_tokens,
        COALESCE(SUM(
          CASE 
            WHEN other IS NOT NULL 
             AND other <> '' 
             AND other ~ '^\s*\{'
            THEN COALESCE((other::json ->> 'cache_tokens')::bigint, 0)
            ELSE 0
          END
        ), 0) as cache_tokens
      FROM public.logs
      ${whereClause}
      GROUP BY username, (created_at / 3600) * 3600
      ORDER BY hour_bucket, username
    `;

    const result = await query(tsQuery, params);

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

    function buildSeriesFromMaps(maps: Map<string, number>[]) {
      return hourBuckets.map((hour) => {
        const point: Record<string, number | string> = { time: hour };
        for (const name of usernames) {
          const key = `${name}-${hour}`;
          point[name] = maps.reduce((sum, m) => sum + (m.get(key) || 0), 0);
        }
        return point;
      });
    }
  } catch (error) {
    console.error('Time series API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
