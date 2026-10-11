import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { settle } from './settle';

describe('settle', () => {
  it('largest debtor pays largest creditor first', () => {
    const net = new Map([[1, 3000], [2, -2200], [3, -800]]);
    expect(settle(net)).toEqual([
      { fromId: 2, toId: 1, amount: 2200 },
      { fromId: 3, toId: 1, amount: 800 },
    ]);
  });
  it('everyone square means no transfers', () => {
    expect(settle(new Map([[1, 0], [2, 0]]))).toEqual([]);
  });
  it('property: applying the transfers zeroes everyone, with at most n-1 positive transfers', () => {
    fc.assert(fc.property(
      fc.array(fc.integer({ min: -100_000, max: 100_000 }), { minLength: 1, maxLength: 7 }),
      values => {
        const all = [...values, -values.reduce((a, b) => a + b, 0)];
        const net = new Map(all.map((v, i) => [i + 1, v]));
        const transfers = settle(net);
        const after = new Map(net);
        for (const t of transfers) {
          if (t.amount <= 0) return false;
          after.set(t.fromId, after.get(t.fromId)! + t.amount);
          after.set(t.toId, after.get(t.toId)! - t.amount);
        }
        return [...after.values()].every(v => v === 0) && transfers.length <= Math.max(0, all.length - 1);
      },
    ));
  });
});
