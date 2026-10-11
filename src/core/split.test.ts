import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { splitExpense, type ShareInput, type SplitResult } from './split';

function owed(r: SplitResult): Record<number, number> {
  if (!r.ok) throw new Error(r.error);
  return Object.fromEntries(r.owed);
}
const eq = (...ids: number[]): ShareInput[] => ids.map(personId => ({ personId, weight: 1 }));

describe('splitExpense', () => {
  it('equal split hands odd cents out in list order', () => {
    expect(owed(splitExpense(1000, eq(1, 2, 3)))).toEqual({ 1: 334, 2: 333, 3: 333 });
  });
  it('shares 2:1:1', () => {
    expect(owed(splitExpense(1000, [
      { personId: 1, weight: 2 }, { personId: 2, weight: 1 }, { personId: 3, weight: 1 },
    ]))).toEqual({ 1: 500, 2: 250, 3: 250 });
  });
  it('fixed amount, rest by shares', () => {
    expect(owed(splitExpense(6000, [
      { personId: 1, weight: 1 }, { personId: 2, weight: 1, fixed: 3000 }, { personId: 3, weight: 1 },
    ]))).toEqual({ 1: 1500, 2: 3000, 3: 1500 });
  });
  it('fixed covering the whole bill leaves others at 0', () => {
    expect(owed(splitExpense(1000, [{ personId: 1, weight: 1, fixed: 1000 }, { personId: 2, weight: 1 }])))
      .toEqual({ 1: 1000, 2: 0 });
  });
  it('treat: payer alone owes all of it', () => {
    expect(owed(splitExpense(1200, [{ personId: 7, weight: 1 }]))).toEqual({ 7: 1200 });
  });
  it('weight 0 people are out', () => {
    expect(owed(splitExpense(1000, [{ personId: 1, weight: 1 }, { personId: 2, weight: 0 }]))).toEqual({ 1: 1000 });
  });
  it.each<[string, number, ShareInput[], string]>([
    ['fixed > bill', 1000, [{ personId: 1, weight: 1, fixed: 1500 }], 'Fixed amounts exceed the bill'],
    ['nobody left to split', 1000, [{ personId: 1, weight: 0 }, { personId: 2, weight: 0 }], 'Nobody is splitting the rest'],
    ['zero amount', 0, eq(1), 'Amount must be more than zero'],
    ['negative weight', 1000, [{ personId: 1, weight: -1 }], 'Shares must be whole numbers, 0 or more'],
    ['fractional weight', 1000, [{ personId: 1, weight: 1.5 }], 'Shares must be whole numbers, 0 or more'],
    ['negative fixed', 1000, [{ personId: 1, weight: 1, fixed: -1 }], 'Fixed amounts must be 0 or more'],
    ['duplicate person', 1000, [{ personId: 1, weight: 1 }, { personId: 1, weight: 1 }], 'Each person can only appear once'],
  ])('rejects %s', (_name, amount, shares, error) => {
    expect(splitExpense(amount, shares)).toEqual({ ok: false, error });
  });

  it('property: owed always sums to the amount and stays within 1 of the exact share', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 10_000_000 }),
      fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 8 }).filter(ws => ws.some(w => w > 0)),
      (amount, weights) => {
        const shares = weights.map((weight, i) => ({ personId: i + 1, weight }));
        const r = splitExpense(amount, shares);
        if (!r.ok) return false;
        const total = weights.reduce((a, b) => a + b, 0);
        let sum = 0;
        for (const s of shares) {
          const got = r.owed.get(s.personId) ?? 0;
          sum += got;
          if (got < 0 || Math.abs(got - (amount * s.weight) / total) >= 1) return false;
        }
        return sum === amount;
      },
    ));
  });
});
