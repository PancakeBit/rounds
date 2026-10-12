import { describe, it, expect } from 'vitest';
import { nightStats, formatGap, type StatExpense } from './stats';

const JO = 1, SAM = 2, KAI = 3;
const MIN = 60_000;
const eq = (...ids: number[]) => ids.map(personId => ({ personId, weight: 1 }));

const night: StatExpense[] = [
  { payerId: JO, amount: 3000, shares: eq(JO, SAM, KAI), categories: ['drinks'], isTreat: false, createdAt: 0 },
  { payerId: SAM, amount: 1200, shares: eq(SAM), categories: ['food'], isTreat: true, createdAt: 10 * MIN },
  { payerId: JO, amount: 900, shares: eq(JO, KAI), categories: ['taxi'], isTreat: false, createdAt: 70 * MIN },
];

describe('nightStats', () => {
  it('computes totals and awards', () => {
    expect(nightStats(night)).toEqual({
      total: 5100,
      rounds: 3,
      byCategory: [
        { category: 'drinks', amount: 3000 },
        { category: 'food', amount: 1200 },
        { category: 'taxi', amount: 900 },
      ],
      topCategory: 'drinks',
      bigSpender: { personId: JO, amount: 3900 },
      mostGenerous: { personId: SAM, amount: 1200 },
      sponge: { personId: KAI, amount: 1450 },
      longestGapMs: 60 * MIN,
    });
  });
  it('empty night has no awards', () => {
    expect(nightStats([])).toEqual({
      total: 0, rounds: 0, byCategory: [], topCategory: null,
      bigSpender: null, mostGenerous: null, sponge: null, longestGapMs: null,
    });
  });
});

describe('formatGap', () => {
  it('formats hours and minutes', () => {
    expect(formatGap(65 * MIN)).toBe('1h 5m');
    expect(formatGap(12 * MIN)).toBe('12m');
    expect(formatGap(20_000)).toBe('0m');
  });
});

describe('payments for several things', () => {
  it('count evenly towards each category, spare cents to the first', () => {
    const s = nightStats([
      { payerId: 1, amount: 1001, shares: eq(1, 2), categories: ['food', 'drinks'], isTreat: false, createdAt: 0 },
      { payerId: 2, amount: 300, shares: eq(1, 2), categories: ['drinks'], isTreat: false, createdAt: 1 },
    ]);
    expect(s.byCategory).toEqual([{ category: 'drinks', amount: 800 }, { category: 'food', amount: 501 }]);
    expect(s.total).toBe(1301);
  });
});
