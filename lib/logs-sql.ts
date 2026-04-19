import { getCacheTokensSql, getInputTokensSql } from '@/lib/sql-dialect';

export const CACHE_TOKENS_SQL = getCacheTokensSql('postgres', 'other');

export const INPUT_TOKENS_SQL = getInputTokensSql('postgres', 'prompt_tokens', 'other');

export { getCacheTokensSql, getInputTokensSql } from '@/lib/sql-dialect';
