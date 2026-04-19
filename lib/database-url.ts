export type DatabaseType = 'mysql' | 'postgres';

export type ParsedDatabaseUrl = {
  database: DatabaseType;
  url: string;
};

const MYSQL_TCP_DSN_PATTERN = /^[^:@/()]+:[^@/()]+@tcp\([^:/()]+:\d+\)\/[^/?#]+$/;
const UNSUPPORTED_DATABASE_URL_FORMAT = 'Unsupported DATABASE_URL format';

export const parseDatabaseUrl = (databaseUrl: string): ParsedDatabaseUrl => {
  try {
    const { protocol } = new URL(databaseUrl);

    if (protocol === 'postgres:' || protocol === 'postgresql:') {
      return {
        database: 'postgres',
        url: databaseUrl,
      };
    }

    if (protocol === 'mysql:') {
      return {
        database: 'mysql',
        url: databaseUrl,
      };
    }
  } catch (_error) {
  }

  if (MYSQL_TCP_DSN_PATTERN.test(databaseUrl)) {
    return {
      database: 'mysql',
      url: databaseUrl,
    };
  }

  throw new Error(UNSUPPORTED_DATABASE_URL_FORMAT);
};
