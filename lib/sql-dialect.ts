import type { DatabaseDialect } from '@/lib/database-url';

export type QueryParam = boolean | null | number | string;

type SqlContext = {
  addParam: (value: QueryParam) => string;
  params: QueryParam[];
};

export const buildEqualityOrTextCastCondition = (
  dialect: DatabaseDialect,
  column: string,
  castColumn: string,
  placeholder: string,
): string => `(${column} = ${placeholder} OR ${getTextCastSql(dialect, castColumn)} = ${placeholder})`;

const getJsonObjectGuardSql = (dialect: DatabaseDialect, otherColumn: string) => (
  dialect === 'postgres'
    ? `${otherColumn} IS NOT NULL AND ${otherColumn} <> '' AND ${otherColumn} ~ '^\\s*\\{'`
    : `${otherColumn} IS NOT NULL AND ${otherColumn} <> '' AND JSON_VALID(${otherColumn})`
);

const getClaudeMessagesSql = (dialect: DatabaseDialect, otherColumn: string) => (
  dialect === 'postgres'
    ? `${otherColumn} IS NOT NULL AND ${otherColumn} <> '' AND ${otherColumn} ~ '"request_conversion"\\s*:\\s*\\[[^\\]]*"Claude Messages"'`
    : `${getJsonObjectGuardSql(dialect, otherColumn)} AND JSON_SEARCH(JSON_EXTRACT(${otherColumn}, '$.request_conversion'), 'one', 'Claude Messages') IS NOT NULL`
);

export const createSqlContext = (dialect: DatabaseDialect): SqlContext => {
  const params: QueryParam[] = [];

  return {
    addParam: (value) => {
      params.push(value);

      return dialect === 'postgres' ? `$${params.length}` : '?';
    },
    params,
  };
};

export const getLogsTableName = (dialect: DatabaseDialect): string => (
  dialect === 'postgres' ? 'public.logs' : 'logs'
);

export const getChannelsTableName = (dialect: DatabaseDialect): string => (
  dialect === 'postgres' ? 'public.channels' : 'channels'
);

export const getTextCastSql = (dialect: DatabaseDialect, column: string): string => (
  dialect === 'postgres' ? `${column}::text` : `CAST(${column} AS CHAR)`
);

export const getCacheTokensSql = (dialect: DatabaseDialect, otherColumn: string): string => (
  dialect === 'postgres'
    ? `
      CASE
        WHEN ${getJsonObjectGuardSql(dialect, otherColumn)}
        THEN COALESCE((${otherColumn}::json ->> 'cache_tokens')::bigint, 0)
        ELSE 0
      END
    `
    : `
      CASE
        WHEN ${getJsonObjectGuardSql(dialect, otherColumn)}
        THEN COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(${otherColumn}, '$.cache_tokens')) AS SIGNED), 0)
        ELSE 0
      END
    `
);

export const getInputTokensSql = (
  dialect: DatabaseDialect,
  promptTokensColumn: string,
  otherColumn: string,
): string => `
  COALESCE(${promptTokensColumn}, 0) +
  CASE
    WHEN ${getClaudeMessagesSql(dialect, otherColumn)}
    THEN ${getCacheTokensSql(dialect, otherColumn)}
    ELSE 0
  END
`;

export const getFirstTokenTimeSql = (dialect: DatabaseDialect, otherColumn: string): string => (
  dialect === 'postgres'
    ? `
      CASE
        WHEN ${getJsonObjectGuardSql(dialect, otherColumn)}
        THEN COALESCE((${otherColumn}::json ->> 'frt')::double precision, 0)
        ELSE 0
      END
    `
    : `
      CASE
        WHEN ${getJsonObjectGuardSql(dialect, otherColumn)}
        THEN COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(${otherColumn}, '$.frt')) AS DECIMAL(10, 3)), 0)
        ELSE 0
      END
    `
);
