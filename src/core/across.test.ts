import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { across, nightTransfers, type OpenNightData } from './across';

const JO = 1, SAM = 2, KAI = 3, MIA = 4;
const night = (nightId: number, title: string, memberIds: number[], expenses: OpenNightData['expenses'], extra: Partial<OpenNightData> = {}): OpenNightData =>
  ({ nightId, title, memberIds, expenses, paid: [], unpaid: [], ...extra });
const only = (personId: number, amount: number) => [{ personId, weight: 0, extra: amount }];

// Each night's own Settle up plan is what gets added up. Friday: Sam owes Jo 8. Saturday: Jo owes Sam 5.
// Sunday: Kai owes Jo 18.50, Mia owes Sam 12.
const fri = night(1, 'Friday', [JO, SAM], [{ payerId: JO, amount: 800, shares: only(SAM, 800) }]);
const sat = night(2, 'Saturday', [JO, SAM], [{ payerId: SAM, amount: 500, shares: only(JO, 500) }]);
const sun = night(3, 'Sunday', [JO, SAM, KAI, MIA], [
  { payerId: JO, amount: 1850, shares: only(KAI, 1850) },
  { payerId: SAM, amount: 1200, shares: only(MIA, 1200) },
]);

describe('across', () => {
  it('adds each person up across nights', () => {
    const r = across([fri, sat, sun]);
    expect(Object.fromEntries(r.net)).toEqual({ [JO]: 2150, [SAM]: 900, [KAI]: -1850, [MIA]: -1200 });
  });
  it('nets each pair across nights and keeps the pieces', () => {
    const r = across([fri, sat, sun]);
    const samJo = r.pairs.find(p => p.fromId === SAM && p.toId === JO)!;
    expect(samJo.amount).toBe(300);
    expect(samJo.pieces).toEqual([
      { nightId: 1, title: 'Friday', fromId: SAM, toId: JO, amount: 800 },
      { nightId: 2, title: 'Saturday', fromId: JO, toId: SAM, amount: 500 },
    ]);
    expect(r.pairs.map(p => [p.fromId, p.toId, p.amount])).toEqual([[KAI, JO, 1850], [MIA, SAM, 1200], [SAM, JO, 300]]);
  });
  it('a pair that cancels out across nights is left out', () => {
    const back = night(4, 'Back', [JO, SAM], [{ payerId: SAM, amount: 800, shares: only(JO, 800) }]);
    const r = across([fri, back]);
    expect(r.pairs.find(p => (p.fromId === SAM && p.toId === JO) || (p.fromId === JO && p.toId === SAM))).toBeUndefined();
  });
  it('ticked payments count', () => {
    const r = across([{ ...fri, paid: [{ fromId: SAM, toId: JO, amount: 800 }] }]);
    expect(r.net.get(JO) ?? 0).toBe(0);
  });
  it('uses the plan Settle up shows while it still holds', () => {
    // Another valid way to square Sunday: kept as is.
    const plan = [{ fromId: KAI, toId: SAM, amount: 1200 }, { fromId: KAI, toId: JO, amount: 650 }, { fromId: MIA, toId: JO, amount: 1200 }];
    expect(nightTransfers({ ...sun, unpaid: plan })).toEqual(plan);
    expect(nightTransfers({ ...sun, unpaid: [{ fromId: MIA, toId: JO, amount: 1 }] })).toEqual([
      { fromId: KAI, toId: JO, amount: 1850 }, { fromId: MIA, toId: SAM, amount: 1200 },
    ]);
  });
  it('property: everyone adds up to zero, and pairs agree with people', () => {
    fc.assert(fc.property(
      fc.array(fc.array(fc.record({ payer: fc.integer({ min: 1, max: 4 }), who: fc.integer({ min: 1, max: 4 }), amount: fc.integer({ min: 1, max: 50_000 }) }), { maxLength: 6 }), { maxLength: 4 }),
      raw => {
        const nights = raw.map((es, i) => night(i + 1, `N${i}`, [1, 2, 3, 4], es.map(e => ({ payerId: e.payer, amount: e.amount, shares: only(e.who, e.amount) }))));
        const r = across(nights);
        const total = [...r.net.values()].reduce((a, b) => a + b, 0);
        const fromPairs = new Map<number, number>();
        for (const p of r.pairs) {
          fromPairs.set(p.fromId, (fromPairs.get(p.fromId) ?? 0) - p.amount);
          fromPairs.set(p.toId, (fromPairs.get(p.toId) ?? 0) + p.amount);
        }
        return total === 0 && [...r.net].every(([id, v]) => (fromPairs.get(id) ?? 0) === v);
      },
    ));
  });
});
