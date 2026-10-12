import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { itemShares, splitItems, type ItemInput, type ItemSplit } from './items';

function owed(r: ItemSplit): Record<number, number> {
  if (!r.ok) throw new Error(r.error);
  return Object.fromEntries(r.owed);
}
const item = (price: number, ...claims: [number, number][]): ItemInput => ({
  name: 'x', price, claims: claims.map(([personId, count]) => ({ personId, count })),
});
const everyone = [1, 2, 3];

describe('splitItems', () => {
  it('each person pays for what they claimed', () => {
    const r = splitItems([item(1200, [1, 1]), item(950, [2, 1]), item(2400, [3, 1])], 0, everyone);
    expect(owed(r)).toEqual({ 1: 1200, 2: 950, 3: 2400 });
    expect(r.ok && r.subtotal).toBe(4550);
    expect(r.ok && r.total).toBe(4550);
  });
  it('an item two people claim is split evenly, odd cents in claim order', () => {
    expect(owed(splitItems([item(1001, [2, 1], [1, 1])], 0, everyone))).toEqual({ 2: 501, 1: 500 });
  });
  it('tapping a name again takes a bigger part (3 beers: Jo x2, Sam x1)', () => {
    expect(owed(splitItems([item(1500, [1, 2], [2, 1])], 0, everyone))).toEqual({ 1: 1000, 2: 500 });
  });
  it('an item nobody claimed is shared by everyone', () => {
    expect(owed(splitItems([item(900), item(300, [1, 1])], 0, everyone))).toEqual({ 1: 600, 2: 300, 3: 300 });
  });
  it('claims with a count of 0 count as unclaimed', () => {
    expect(owed(splitItems([item(900, [1, 0])], 0, everyone))).toEqual({ 1: 300, 2: 300, 3: 300 });
  });
  it('service is spread by what each person claimed', () => {
    // Jo had 30 of 60 in items, so pays half of the 6.00 service.
    const r = splitItems([item(3000, [1, 1]), item(2000, [2, 1]), item(1000, [3, 1])], 600, everyone);
    expect(owed(r)).toEqual({ 1: 3300, 2: 2200, 3: 1100 });
    expect(r.ok && r.total).toBe(6600);
  });
  it('service rounding still adds up exactly', () => {
    const r = splitItems([item(100, [1, 1]), item(100, [2, 1]), item(100, [3, 1])], 100, everyone);
    expect(owed(r)).toEqual({ 1: 134, 2: 133, 3: 133 });
  });
  it('refuses bad input', () => {
    expect(splitItems([], 0, everyone)).toEqual({ ok: false, error: 'Add an item' });
    expect(splitItems([item(0, [1, 1])], 0, everyone)).toEqual({ ok: false, error: 'Every item needs a price' });
    expect(splitItems([item(100, [1, 1])], -1, everyone)).toEqual({ ok: false, error: 'Service must be 0 or more' });
    expect(splitItems([item(100)], 0, [])).toEqual({ ok: false, error: 'Nobody is sharing the rest' });
    expect(splitItems([item(100, [1, 1.5])], 0, everyone)).toEqual({ ok: false, error: 'Claims must be whole numbers' });
  });
  it('property: what people owe always adds up to items plus service', () => {
    const arbItem = fc.record({
      price: fc.integer({ min: 1, max: 100_000 }),
      claims: fc.uniqueArray(fc.record({ personId: fc.integer({ min: 1, max: 6 }), count: fc.integer({ min: 0, max: 5 }) }), { selector: c => c.personId, maxLength: 6 }),
    });
    fc.assert(fc.property(fc.array(arbItem, { minLength: 1, maxLength: 12 }), fc.integer({ min: 0, max: 50_000 }), (raw, service) => {
      const items = raw.map(r => ({ name: 'x', ...r }));
      const r = splitItems(items, service, [1, 2, 3, 4, 5, 6]);
      if (!r.ok) return false;
      const sum = [...r.owed.values()].reduce((a, b) => a + b, 0);
      return sum === r.total && r.total === items.reduce((t, i) => t + i.price, 0) + service && [...r.owed.values()].every(v => v >= 0);
    }));
  });
});

describe('splitItems breakdown', () => {
  it('says what each person owes for each item and for the service', () => {
    // Beer 15.00: Jo x2, Sam x1. Nachos 9.00: nobody, so everyone. Service 3.00 by spend.
    const r = splitItems([item(1500, [1, 2], [2, 1]), item(900)], 300, everyone);
    if (!r.ok) throw new Error(r.error);
    expect(r.perItem.map(m => Object.fromEntries(m))).toEqual([{ 1: 1000, 2: 500 }, { 1: 300, 2: 300, 3: 300 }]);
    expect(Object.fromEntries(r.service)).toEqual({ 1: 163, 2: 100, 3: 37 }); // 300 by 1300 : 800 : 300; the half cent goes to Jo
    for (const [p, total] of r.owed) {
      const parts = r.perItem.reduce((t, m) => t + (m.get(p) ?? 0), 0) + (r.service.get(p) ?? 0);
      expect(parts).toBe(total);
    }
  });
  it('no service: the service map is empty', () => {
    const r = splitItems([item(100, [1, 1])], 0, everyone);
    expect(r.ok && r.service.size).toBe(0);
  });
});

describe('itemShares', () => {
  it('turns item totals into exact amounts with no plain share', () => {
    const r = itemShares([item(1200, [1, 1]), item(800, [2, 1])], 0, everyone, 1, false);
    expect(r).toEqual({ ok: true, amount: 2000, shares: [{ personId: 1, weight: 0, extra: 1200 }, { personId: 2, weight: 0, extra: 800 }] });
  });
  it('on me: the payer covers the whole receipt', () => {
    expect(itemShares([item(1200, [1, 1]), item(800, [2, 1])], 100, everyone, 3, true))
      .toEqual({ ok: true, amount: 2100, shares: [{ personId: 3, weight: 1 }] });
  });
  it('passes errors through', () => {
    expect(itemShares([], 0, everyone, 1, false)).toEqual({ ok: false, error: 'Add an item' });
  });
});
