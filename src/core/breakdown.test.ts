import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { whoHadWhat, type BreakdownExpense } from './breakdown';
import { itemShares } from './items';
import type { ShareInput } from './split';

const JO = 1, SAM = 2, KAI = 3;
const ids = [JO, SAM, KAI];
const eq = (...p: number[]) => p.map(personId => ({ personId, weight: 1 }));
const plain = (amount: number, note: string, shares: ShareInput[] = eq(JO, SAM, KAI), payerId = JO): BreakdownExpense =>
  ({ payerId, amount, note, categories: ['drinks'], isTreat: false, shares });

describe('whoHadWhat', () => {
  it('plain payments: each person gets their share, labelled by the note', () => {
    const r = whoHadWhat([plain(900, 'Round 1'), plain(600, 'Taxi', eq(JO, SAM))], ids);
    expect(r.get(JO)).toEqual({ total: 600, lines: [{ label: 'Round 1', amount: 300, payerId: JO }, { label: 'Taxi', amount: 300, payerId: JO }] });
    expect(r.get(KAI)).toEqual({ total: 300, lines: [{ label: 'Round 1', amount: 300, payerId: JO }] });
  });
  it('no note: the category names it', () => {
    const r = whoHadWhat([{ ...plain(300, ''), categories: ['drinks', 'food'] }], ids);
    expect(r.get(JO)?.lines[0].label).toBe('Drinks & Food');
  });
  it('itemised payments list each item, with ×N and the service by payment', () => {
    const items = [
      { name: 'Beer', price: 1500, claims: [{ personId: JO, count: 2 }, { personId: SAM, count: 1 }] },
      { name: 'Nachos', price: 900, claims: [] },
    ];
    const saved = itemShares(items, 300, ids, JO, false); // what the app stores for it
    if (!saved.ok) throw new Error(saved.error);
    const e: BreakdownExpense = { ...plain(saved.amount, 'Dinner', saved.shares), items, service: 300 };
    const r = whoHadWhat([e], ids);
    expect(r.get(JO)).toEqual({
      total: 1300 + 163,
      lines: [{ label: 'Beer ×2', amount: 1000, payerId: JO }, { label: 'Nachos', amount: 300, payerId: JO }, { label: 'Dinner service', amount: 163, payerId: JO }],
    });
    expect(r.get(KAI)?.lines).toEqual([{ label: 'Nachos', amount: 300, payerId: JO }, { label: 'Dinner service', amount: 37, payerId: JO }]);
  });
  it('someone who joined after an itemised payment is not handed part of it', () => {
    // Saved when only Jo and Sam were there: the unclaimed Nachos went 450 / 450.
    const e: BreakdownExpense = {
      ...plain(900, 'Dinner', [{ personId: JO, weight: 0, extra: 450 }, { personId: SAM, weight: 0, extra: 450 }]),
      items: [{ name: 'Nachos', price: 900, claims: [] }],
      service: 0,
    };
    const r = whoHadWhat([e], ids); // Kai is in the member list now
    expect(r.get(JO)).toEqual({ total: 450, lines: [{ label: 'Dinner', amount: 450, payerId: JO }] });
    expect(r.has(KAI)).toBe(false);
  });
  it('a treat is down to whoever paid, marked on me', () => {
    const r = whoHadWhat([{ ...plain(1600, 'Milkshakes', [{ personId: SAM, weight: 1 }], SAM), isTreat: true }], ids);
    expect(r.get(SAM)).toEqual({ total: 1600, lines: [{ label: 'Milkshakes (on me)', amount: 1600, payerId: SAM }] });
    expect(r.has(JO)).toBe(false);
  });
  it('people come out in the order given, and only if they had something', () => {
    const r = whoHadWhat([plain(500, 'x', eq(KAI, JO))], ids);
    expect([...r.keys()]).toEqual([JO, KAI]);
  });
  it('property: everyone together had exactly the whole tab', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        amount: fc.integer({ min: 1, max: 100_000 }),
        weights: fc.tuple(fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 3 }), fc.integer({ min: 1, max: 3 })),
      }), { maxLength: 10 }),
      raw => {
        const exps = raw.map(r => plain(r.amount, 'x', ids.map((personId, i) => ({ personId, weight: r.weights[i] }))));
        const r = whoHadWhat(exps, ids);
        const sum = [...r.values()].reduce((t, p) => t + p.total, 0);
        return sum === exps.reduce((t, e) => t + e.amount, 0)
          && [...r.values()].every(p => p.total === p.lines.reduce((t, l) => t + l.amount, 0));
      },
    ));
  });
});
