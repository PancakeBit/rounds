import { describe, it, expect } from 'vitest';
import { balanceHistory, nightBalances, type ExpenseLike, type Transfer } from './balances';

const JO = 1, SAM = 2, KAI = 3;
const all = [JO, SAM, KAI];
const eq = (...ids: number[]) => ids.map(personId => ({ personId, weight: 1 }));
const obj = <V,>(m: Map<number, V>) => Object.fromEntries(m);

describe('nightBalances', () => {
  it('payer is owed what others consumed', () => {
    const e: ExpenseLike[] = [{ payerId: JO, amount: 3000, shares: eq(JO, SAM, KAI) }];
    expect(obj(nightBalances(all, e))).toEqual({ [JO]: 2000, [SAM]: -1000, [KAI]: -1000 });
  });
  it('payer who did not partake is owed the full amount', () => {
    const e: ExpenseLike[] = [{ payerId: JO, amount: 1000, shares: eq(SAM) }];
    expect(obj(nightBalances(all, e))).toEqual({ [JO]: 1000, [SAM]: -1000, [KAI]: 0 });
  });
  it('a treat creates no debt', () => {
    const e: ExpenseLike[] = [{ payerId: SAM, amount: 1200, shares: eq(SAM) }];
    expect(obj(nightBalances(all, e))).toEqual({ [JO]: 0, [SAM]: 0, [KAI]: 0 });
  });
  it('paid transfers reduce what is still owed', () => {
    const e: ExpenseLike[] = [{ payerId: JO, amount: 3000, shares: eq(JO, SAM, KAI) }];
    const net = nightBalances(all, e, [{ fromId: SAM, toId: JO, amount: 1000 }]);
    expect(obj(net)).toEqual({ [JO]: 1000, [SAM]: 0, [KAI]: -1000 });
  });
  it('members with no rounds are present at 0', () => {
    expect(obj(nightBalances(all, []))).toEqual({ [JO]: 0, [SAM]: 0, [KAI]: 0 });
  });
  it('throws on an invalid stored expense', () => {
    expect(() => nightBalances(all, [{ payerId: JO, amount: 100, shares: [] }])).toThrow('Stored expense is invalid');
  });
});

describe('balanceHistory', () => {
  const night: ExpenseLike[] = [
    { payerId: JO, amount: 3000, shares: eq(JO, SAM, KAI) },
    { payerId: KAI, amount: 1200, shares: eq(KAI) }, // Kai's treat
    { payerId: SAM, amount: 600, shares: eq(JO, SAM) },
  ];
  const paid: Transfer[] = [{ fromId: KAI, toId: JO, amount: 1000 }];

  it('adds an entry only for rounds that move a balance', () => {
    expect(obj(balanceHistory(all, night))).toEqual({
      [JO]: [0, 2000, 1700],
      [SAM]: [0, -1000, -700],
      [KAI]: [0, -1000],
    });
  });
  it('appends one entry for paid transfers', () => {
    const h = balanceHistory(all, night, paid);
    expect(h.get(JO)).toEqual([0, 2000, 1700, 700]);
    expect(h.get(KAI)).toEqual([0, -1000, 0]);
    expect(h.get(SAM)).toEqual([0, -1000, -700]);
  });
  it('members with no rounds are a single 0', () => {
    expect(obj(balanceHistory(all, []))).toEqual({ [JO]: [0], [SAM]: [0], [KAI]: [0] });
  });
  it('last entry always equals nightBalances', () => {
    const net = nightBalances(all, night, paid);
    for (const [id, h] of balanceHistory(all, night, paid)) expect(h.at(-1)).toBe(net.get(id));
  });
});
