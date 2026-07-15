import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { jwtVerify } from 'jose';

import { getDatabaseDialect, query } from '@/lib/db';
import { getSessionSecret } from '@/lib/env';
import { getLogsTableName } from '@/lib/sql-dialect';

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

    const dialect = getDatabaseDialect();
    const logsTableName = getLogsTableName(dialect);

    // Get unique users
    const usersQuery = `
      SELECT DISTINCT username
      FROM ${logsTableName}
      WHERE type = 2 AND username IS NOT NULL AND username <> ''
      ORDER BY username
      LIMIT 100
    `;
    const usersResult = await query(usersQuery);

    // Get unique models
    const modelsQuery = `
      SELECT DISTINCT model_name
      FROM ${logsTableName}
      WHERE type = 2 AND model_name IS NOT NULL AND model_name <> ''
      ORDER BY model_name
      LIMIT 100
    `;
    const modelsResult = await query(modelsQuery);

    const tokensQuery = `
      SELECT DISTINCT token_name, username
      FROM ${logsTableName}
      WHERE type = 2 AND token_name IS NOT NULL AND token_name <> ''
      ORDER BY username, token_name
      LIMIT 100
    `;
    const tokensResult = await query(tokensQuery);

    // Get unique channels
    const channelsQuery = `
      SELECT DISTINCT channel_name
      FROM ${logsTableName}
      WHERE type = 2 AND channel_name IS NOT NULL AND channel_name <> ''
      ORDER BY channel_name
      LIMIT 100
    `;
    const channelsResult = await query(channelsQuery);

    return NextResponse.json({
      users: usersResult.rows.map((row: { username: string }) => row.username),
      models: modelsResult.rows.map((row: { model_name: string }) => row.model_name),
      tokens: tokensResult.rows.map((row: { token_name: string; username: string }) => ({
        name: row.token_name,
        username: row.username,
      })),
      channels: channelsResult.rows.map((row: { channel_name: string }) => row.channel_name),
    });
  } catch (error) {
    console.error('Filters API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
