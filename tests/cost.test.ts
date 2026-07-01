import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseCostExchangeRate, quotaToCost } from '@/lib/cost';

describe('cost helpers', () => {
  it('parses ratio exchange rates', () => {
    assert.equal(parseCostExchangeRate('1:7'), 7);
    assert.equal(parseCostExchangeRate('2:7'), 3.5);
  });

  it('converts new-api quota units to display cost', () => {
    assert.equal(quotaToCost(500_000, 7), 7);
    assert.equal(quotaToCost(250_000, 7), 3.5);
  });

  it('rejects invalid exchange rates', () => {
    assert.throws(
      () => parseCostExchangeRate('0:7'),
      { message: 'COST_EXCHANGE_RATE must use ratio like 1:7' },
    );
  });
});
