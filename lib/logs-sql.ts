const JSON_LOG_SQL = `other IS NOT NULL AND other <> '' AND other ~ '^\\s*\\{'`;

const CLAUDE_MESSAGES_SQL = `other IS NOT NULL AND other <> '' AND other ~ '"request_conversion"\\s*:\\s*\\[[^\\]]*"Claude Messages"'`;

export const CACHE_TOKENS_SQL = `
  CASE
    WHEN ${JSON_LOG_SQL}
    THEN COALESCE((other::json ->> 'cache_tokens')::bigint, 0)
    ELSE 0
  END
`;

export const INPUT_TOKENS_SQL = `
  COALESCE(prompt_tokens, 0) +
  CASE
    WHEN ${CLAUDE_MESSAGES_SQL}
    THEN ${CACHE_TOKENS_SQL}
    ELSE 0
  END
`;
