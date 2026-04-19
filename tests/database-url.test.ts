import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

type DatabaseType = 'mysql' | 'postgres';

type DatabaseUrlModule = {
  parseDatabaseUrl: (databaseUrl: string) => {
    database: DatabaseType;
    url: string;
  };
};

type LoadTsFile = (filePath: string) => Promise<unknown>;

const loadDatabaseUrlModule = async () => {
  const maybeLoadTsFile = (globalThis as { __loadTsFile?: LoadTsFile }).__loadTsFile;

  if (typeof maybeLoadTsFile !== 'function') {
    throw new Error('TypeScript test loader is not available.');
  }

  return maybeLoadTsFile(resolve(process.cwd(), 'lib/database-url.ts')) as Promise<DatabaseUrlModule>;
};

describe('parseDatabaseUrl', () => {
  it('parses postgres:// URLs as postgres', async () => {
    const { parseDatabaseUrl } = await loadDatabaseUrlModule();

    assert.deepEqual(
      parseDatabaseUrl('postgres://user:pass@localhost:5432/app'),
      {
        database: 'postgres',
        url: 'postgres://user:pass@localhost:5432/app',
      },
    );
  });

  it('parses postgresql:// URLs as postgres', async () => {
    const { parseDatabaseUrl } = await loadDatabaseUrlModule();

    assert.deepEqual(
      parseDatabaseUrl('postgresql://user:pass@localhost:5432/app'),
      {
        database: 'postgres',
        url: 'postgresql://user:pass@localhost:5432/app',
      },
    );
  });

  it('parses mysql:// URLs as mysql', async () => {
    const { parseDatabaseUrl } = await loadDatabaseUrlModule();

    assert.deepEqual(
      parseDatabaseUrl('mysql://user:pass@localhost:3306/app'),
      {
        database: 'mysql',
        url: 'mysql://user:pass@localhost:3306/app',
      },
    );
  });

  it('parses MySQL TCP DSNs as mysql', async () => {
    const { parseDatabaseUrl } = await loadDatabaseUrlModule();

    assert.deepEqual(
      parseDatabaseUrl('user:password@tcp(localhost:3306)/app'),
      {
        database: 'mysql',
        url: 'user:password@tcp(localhost:3306)/app',
      },
    );
  });

  it('rejects unsupported DSNs with a clear error', async () => {
    const { parseDatabaseUrl } = await loadDatabaseUrlModule();

    assert.throws(
      () => parseDatabaseUrl('sqlite:///tmp/app.db'),
      {
        message: 'Unsupported DATABASE_URL format',
      },
    );
  });
});
