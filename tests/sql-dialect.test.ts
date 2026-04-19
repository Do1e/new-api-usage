import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CACHE_TOKENS_SQL, INPUT_TOKENS_SQL } from '@/lib/logs-sql';
import {
  createSqlContext,
  getCacheTokensSql,
  getChannelsTableName,
  getFirstTokenTimeSql,
  getInputTokensSql,
  getLogsTableName,
  getTextCastSql,
} from '@/lib/sql-dialect';

describe('createSqlContext', () => {
  it('builds postgres placeholders in insertion order', () => {
    const context = createSqlContext('postgres');

    assert.equal(context.addParam(123), '$1');
    assert.equal(context.addParam('abc'), '$2');
    assert.deepEqual(context.params, [123, 'abc']);
  });

  it('builds mysql placeholders while preserving params', () => {
    const context = createSqlContext('mysql');

    assert.equal(context.addParam(123), '?');
    assert.equal(context.addParam('abc'), '?');
    assert.deepEqual(context.params, [123, 'abc']);
  });
});

describe('dialect metadata helpers', () => {
  it('switches table names and text casts by dialect', () => {
    assert.equal(getLogsTableName('postgres'), 'public.logs');
    assert.equal(getLogsTableName('mysql'), 'logs');
    assert.equal(getChannelsTableName('postgres'), 'public.channels');
    assert.equal(getChannelsTableName('mysql'), 'channels');
    assert.equal(getTextCastSql('postgres', 'l.user_id'), 'l.user_id::text');
    assert.equal(getTextCastSql('mysql', 'l.user_id'), 'CAST(l.user_id AS CHAR)');
  });
});

describe('metric SQL helpers', () => {
  it('keeps cache token extraction dialect aware', () => {
    assert.match(getCacheTokensSql('postgres', 'l.other'), /l\.other::json/);
    assert.match(getCacheTokensSql('mysql', 'l.other'), /JSON_VALID\(l\.other\)/);
    assert.match(getCacheTokensSql('mysql', 'l.other'), /JSON_EXTRACT\(l\.other, '\$\.cache_tokens'\)/);
  });

  it('keeps input token sql dialect aware', () => {
    assert.match(
      getInputTokensSql('postgres', 'l.prompt_tokens', 'l.other'),
      /Claude Messages/,
    );
    assert.match(
      getInputTokensSql('mysql', 'l.prompt_tokens', 'l.other'),
      /JSON_SEARCH\(JSON_EXTRACT\(l\.other, '\$\.request_conversion'\), 'one', 'Claude Messages'\) IS NOT NULL/,
    );
  });

  it('supports first token time extraction for later route refactors', () => {
    assert.match(getFirstTokenTimeSql('postgres', 'l.other'), /->> 'frt'/);
    assert.match(getFirstTokenTimeSql('mysql', 'l.other'), /JSON_EXTRACT\(l\.other, '\$\.frt'\)/);
  });

  it('keeps the legacy logs-sql exports aligned with postgres behavior', () => {
    assert.equal(CACHE_TOKENS_SQL, getCacheTokensSql('postgres', 'other'));
    assert.equal(INPUT_TOKENS_SQL, getInputTokensSql('postgres', 'prompt_tokens', 'other'));
  });
});
