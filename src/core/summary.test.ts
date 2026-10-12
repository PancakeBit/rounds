import { describe, it, expect } from 'vitest';
import { formatMoney as money } from './money';
import { itemShares } from './items';
import { itemLines, nightSummary, type SummaryInput } from './summary';

const stored = (r: ReturnType<typeof itemShares>) => {
  if (!r.ok) throw new Error(r.error);
  return r.shares;
};

const JO = 1, SAM = 2, KAI = 3, MIA = 4;
const base: SummaryInput = {
  title: 'Friday night',
  date: 'Fri 9 Oct',
  memberIds: [JO, SAM, KAI, MIA],
  names: new Map([[JO, 'Jo'], [SAM, 'Sam'], [KAI, 'Kai'], [MIA, 'Mia']]),
  expenses: [],
  paid: [],
  open: [],
  money,
};
const everyone = [JO, SAM, KAI, MIA].map(personId => ({ personId, weight: 1 }));

describe('nightSummary', () => {
  it('writes the whole night', () => {
    const text = nightSummary({
      ...base,
      expenses: [
        { payerId: JO, amount: 4000, categories: ['drinks'], note: '', isTreat: false, shares: everyone },
        {
          payerId: SAM, amount: 6000, categories: ['food'], note: 'Pizza', isTreat: false,
          shares: [{ personId: JO, weight: 1 }, { personId: SAM, weight: 1 }, { personId: MIA, weight: 2 }],
        },
        { payerId: MIA, amount: 1600, categories: ['snacks'], note: 'Milkshakes', isTreat: true, shares: [{ personId: MIA, weight: 1 }] },
        { payerId: KAI, amount: 800, categories: ['drinks'], note: '', isTreat: false, shares: [{ personId: SAM, weight: 1 }] },
      ],
      paid: [{ fromId: MIA, toId: SAM, amount: 2900 }],
      open: [{ fromId: MIA, toId: JO, amount: 900 }],
    });
    expect(text).toBe([
      'Friday night · Fri 9 Oct',
      'Tab: 124.00 · 4 things paid for',
      '',
      'What got paid',
      '🍺 Drinks 40.00 · Jo paid · everyone',
      '🍔 Pizza 60.00 · Sam paid · Jo, Sam, Mia ×2',
      '🍟 Milkshakes 16.00 · Mia paid · on me',
      '🍺 Drinks 8.00 · Kai paid · for Sam',
      '',
      'Who pays who',
      'Mia → Jo 9.00',
      'Mia → Sam 29.00 (paid)',
    ].join('\n'));
  });

  it('shows exact amounts', () => {
    const text = nightSummary({
      ...base,
      expenses: [{
        payerId: KAI, amount: 6000, categories: ['food'], note: '', isTreat: false,
        shares: [{ personId: SAM, weight: 0, extra: 3000 }, { personId: JO, weight: 1 }, { personId: KAI, weight: 1 }],
      }],
    });
    expect(text).toContain('🍔 Food 60.00 · Kai paid · Sam 30.00, Jo, Kai');
    expect(text).toContain('Tab: 60.00 · 1 thing paid for');
  });

  it('shows extras on top of a share', () => {
    const text = nightSummary({
      ...base,
      expenses: [{
        payerId: JO, amount: 5500, categories: ['drinks'], note: '', isTreat: false,
        shares: everyone.map(s => (s.personId === KAI ? { ...s, extra: 1500 } : s)),
      }, {
        payerId: JO, amount: 5500, categories: ['drinks'], note: '', isTreat: false,
        shares: [{ personId: JO, weight: 2, extra: 500 }, { personId: SAM, weight: 1 }],
      }],
    });
    expect(text).toContain('🍺 Drinks 55.00 · Jo paid · everyone, Kai +15.00');
    expect(text).toContain('🍺 Drinks 55.00 · Jo paid · Jo ×2 +5.00, Sam');
  });

  it('handles an empty night', () => {
    expect(nightSummary(base)).toBe('Friday night · Fri 9 Oct\nTab: 0.00 · 0 things paid for\n\nWho pays who\nNobody owes anybody.');
  });
});

describe('who had what', () => {
  const expenses = [
    { payerId: JO, amount: 900, categories: ['drinks' as const], note: 'Round', isTreat: false, shares: [JO, SAM, KAI].map(personId => ({ personId, weight: 1 })) },
  ];
  it('is left out unless asked for', () => {
    expect(nightSummary({ ...base, expenses })).not.toContain('Who had what');
  });
  it('lists each person with their total and what it is made of', () => {
    const text = nightSummary({ ...base, expenses, breakdown: true });
    expect(text).toContain(['Who had what', 'Jo 3.00: Round 3.00', 'Sam 3.00: Round 3.00', 'Kai 3.00: Round 3.00', '', 'Who pays who'].join('\n'));
  });
});

describe('itemised payments', () => {
  const items = [
    { name: 'Beer', price: 1500, claims: [{ personId: JO, count: 2 }, { personId: SAM, count: 1 }] },
    { name: 'Nachos', price: 950, claims: [] },
    { name: '', price: 400, claims: [{ personId: KAI, count: 1 }] },
  ];
  it('itemLines names each item, who had it, and the service', () => {
    expect(itemLines({ items, service: 300 }, base.memberIds, id => base.names.get(id)!, money)).toEqual([
      'Beer 15.00 · Jo ×2 10.00, Sam 5.00',
      'Nachos 9.50 · everyone 2.37–2.38 each',
      'Item 4.00 · Kai 4.00',
      'Service / tax / tip 3.00',
    ]);
    // Unequal cents across everyone show as a range.
    expect(itemLines({ items: [{ name: 'Chips', price: 1000, claims: [] }], service: 0 }, [JO, SAM, KAI], id => base.names.get(id)!, money))
      .toEqual(['Chips 10.00 · everyone 3.33–3.34 each']);
    // Someone joined after it was saved: the stored amounts no longer match, so names only.
    expect(itemLines({ items: [{ name: 'Chips', price: 1000, claims: [] }], service: 0, shares: [{ personId: JO, weight: 0, extra: 500 }, { personId: SAM, weight: 0, extra: 500 }] }, [JO, SAM, KAI], id => base.names.get(id)!, money))
      .toEqual(['Chips 10.00 · everyone']);
    expect(itemLines({ items: [], service: 0 }, base.memberIds, id => base.names.get(id)!, money)).toEqual([]);
  });
  it('the text export lists the items under the payment', () => {
    const text = nightSummary({
      ...base,
      expenses: [{
        payerId: JO, amount: 3150, categories: ['food'], note: 'Dinner', isTreat: false, items, service: 300,
        shares: stored(itemShares(items, 300, base.memberIds, JO, false)),
      }],
    });
    expect(text.split('\n').slice(4, 9)).toEqual([
      '🍔 Dinner 31.50 · Jo paid · by item',
      '   Beer 15.00 · Jo ×2 10.00, Sam 5.00',
      '   Nachos 9.50 · everyone 2.37–2.38 each',
      '   Item 4.00 · Kai 4.00',
      '   Service / tax / tip 3.00',
    ]);
  });
});
