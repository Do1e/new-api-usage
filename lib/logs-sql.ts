import { parseDatabaseUrl } from '@/lib/database-url';
import { getDatabaseUrl } from '@/lib/env';
import { getCacheTokensSql, getInputTokensSql } from '@/lib/sql-dialect';

const runtimeDialect = parseDatabaseUrl(getDatabaseUrl()).dialect;

export const CACHE_TOKENS_SQL = getCacheTokensSql(runtimeDialect, 'other');

export const INPUT_TOKENS_SQL = getInputTokensSql(runtimeDialect, 'prompt_tokens', 'other');

export { getCacheTokensSql, getInputTokensSql } from '@/lib/sql-dialect';
