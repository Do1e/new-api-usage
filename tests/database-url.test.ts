import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseDatabaseUrl } from '@/lib/database-url';

describe('parseDatabaseUrl', () => {
  it('parses postgres:// URLs as a postgres connection string', () => {
    assert.deepEqual(
      parseDatabaseUrl('postgres://user:pass@localhost:5432/app'),
      {
        connectionString: 'postgres://user:pass@localhost:5432/app',
        dialect: 'postgres',
      },
    );
  });

  it('parses postgresql:// URLs as a postgres connection string', () => {
    assert.deepEqual(
      parseDatabaseUrl('postgresql://user:pass@localhost:5432/app'),
      {
        connectionString: 'postgresql://user:pass@localhost:5432/app',
        dialect: 'postgres',
      },
    );
  });

  it('parses mysql:// URLs as a mysql connection object', () => {
    assert.deepEqual(
      parseDatabaseUrl('mysql://user:pass@localhost:3306/app'),
      {
        connection: {
          database: 'app',
          host: 'localhost',
          password: 'pass',
          port: 3306,
          user: 'user',
        },
        dialect: 'mysql',
      },
    );
  });

  it('parses MySQL TCP DSNs as a mysql connection object', () => {
    assert.deepEqual(
      parseDatabaseUrl('user:password@tcp(localhost:3306)/app'),
      {
        connection: {
          database: 'app',
          host: 'localhost',
          password: 'password',
          port: 3306,
          user: 'user',
        },
        dialect: 'mysql',
      },
    );
  });

  it('parses MySQL TCP DSNs with query strings', () => {
    assert.deepEqual(
      parseDatabaseUrl('user:password@tcp(localhost:3306)/app?parseTime=true'),
      {
        connection: {
          database: 'app',
          host: 'localhost',
          password: 'password',
          port: 3306,
          user: 'user',
        },
        dialect: 'mysql',
      },
    );
  });

  it('rejects bare URL protocol values with a clear error', () => {
    assert.throws(
      () => parseDatabaseUrl('postgres:abc'),
      {
        message: 'Unsupported DATABASE_URL format',
      },
    );

    assert.throws(
      () => parseDatabaseUrl('mysql:abc'),
      {
        message: 'Unsupported DATABASE_URL format',
      },
    );
  });

  it('rejects unsupported DSNs with a clear error', () => {
    assert.throws(
      () => parseDatabaseUrl('sqlite:///tmp/app.db'),
      {
        message: 'Unsupported DATABASE_URL format',
      },
    );
  });
});
