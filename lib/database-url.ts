export type DatabaseDialect = 'mysql' | 'postgres';

type MySqlConnection = {
  database: string;
  host: string;
  password: string;
  port: number;
  user: string;
};

export type ParsedDatabaseUrl =
  | {
      connectionString: string;
      dialect: 'postgres';
    }
  | {
      connection: MySqlConnection;
      dialect: 'mysql';
    };

const MYSQL_URL_PREFIX = 'mysql://';
const POSTGRES_URL_PREFIXES = ['postgres://', 'postgresql://'];
const MYSQL_TCP_DSN_PATTERN = /^([^:@/()]+):([^@/()]+)@tcp\(([^:/()]+):(\d+)\)\/([^?#]+)(?:\?[^#]*)?$/;
const UNSUPPORTED_DATABASE_URL_FORMAT = 'Unsupported DATABASE_URL format';

const unsupportedDatabaseUrlFormat = (): never => {
  throw new Error(UNSUPPORTED_DATABASE_URL_FORMAT);
};

const parseMySqlUrl = (databaseUrl: string): ParsedDatabaseUrl => {
  try {
    const url = new URL(databaseUrl);
    const database = url.pathname.slice(1);
    const port = Number(url.port);

    if (!url.hostname || !url.username || !url.password || !url.port || !database) {
      return unsupportedDatabaseUrlFormat();
    }

    return {
      connection: {
        database: decodeURIComponent(database),
        host: url.hostname,
        password: decodeURIComponent(url.password),
        port,
        user: decodeURIComponent(url.username),
      },
      dialect: 'mysql',
    };
  } catch (_error) {
    return unsupportedDatabaseUrlFormat();
  }
};

const parseMySqlTcpDsn = (databaseUrl: string): ParsedDatabaseUrl | null => {
  const match = MYSQL_TCP_DSN_PATTERN.exec(databaseUrl);

  if (!match) {
    return null;
  }

  const [, user, password, host, port, database] = match;

  return {
    connection: {
      database,
      host,
      password,
      port: Number(port),
      user,
    },
    dialect: 'mysql',
  };
};

export const parseDatabaseUrl = (databaseUrl: string): ParsedDatabaseUrl => {
  if (POSTGRES_URL_PREFIXES.some((prefix) => databaseUrl.startsWith(prefix))) {
    return {
      connectionString: databaseUrl,
      dialect: 'postgres',
    };
  }

  if (databaseUrl.startsWith(MYSQL_URL_PREFIX)) {
    return parseMySqlUrl(databaseUrl);
  }

  const mySqlTcpDsn = parseMySqlTcpDsn(databaseUrl);

  if (mySqlTcpDsn) {
    return {
      ...mySqlTcpDsn,
    };
  }

  return unsupportedDatabaseUrlFormat();
};
