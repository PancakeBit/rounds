import { describe, it, expect } from 'vitest';
import { formatMoney as money } from './money';
import { itemLines, nightSummary, type SummaryInput } from './summary';

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
        { payerId: JO, amount: 4000, category: 'drinks', note: '', isTreat: false, shares: everyone },
        {
          payerId: SAM, amount: 6000, category: 'food', note: 'Pizza', isTreat: false,
          shares: [{ personId: JO, weight: 1 }, { personId: SAM, weight: 1 }, { personId: MIA, weight: 2 }],
        },
        { payerId: MIA, amount: 1600, category: 'snacks', note: 'Milkshakes', isTreat: true, shares: [{ personId: MIA, weight: 1 }] },
        { payerId: KAI, amount: 800, category: 'drinks', note: '', isTreat: false, shares: [{ personId: SAM, weight: 1 }] },
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
        payerId: KAI, amount: 6000, category: 'food', note: '', isTreat: false,
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
        payerId: JO, amount: 5500, category: 'drinks', note: '', isTreat: false,
        shares: everyone.map(s => (s.personId === KAI ? { ...s, extra: 1500 } : s)),
      }, {
        payerId: JO, amount: 5500, category: 'drinks', note: '', isTreat: false,
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

describe('itemised payments', () => {
  const items = [
    { name: 'Beer', price: 1500, claims: [{ personId: JO, count: 2 }, { personId: SAM, count: 1 }] },
    { name: 'Nachos', price: 950, claims: [] },
    { name: '', price: 400, claims: [{ personId: KAI, count: 1 }] },
  ];
  it('itemLines names each item, who had it, and the service', () => {
    expect(itemLines({ items, service: 300 }, id => base.names.get(id)!, money)).toEqual([
      'Beer 15.00 · Jo ×2, Sam',
      'Nachos 9.50 · everyone',
      'Item 4.00 · Kai',
      'Service / tax / tip 3.00',
    ]);
    expect(itemLines({ items: [], service: 0 }, id => base.names.get(id)!, money)).toEqual([]);
  });
  it('the text export lists the items under the payment', () => {
    const text = nightSummary({
      ...base,
      expenses: [{
        payerId: JO, amount: 3150, category: 'food', note: 'Dinner', isTreat: false, items, service: 300,
        shares: [{ personId: JO, weight: 0, extra: 1000 }],
      }],
    });
    expect(text.split('\n').slice(4, 9)).toEqual([
      '🍔 Dinner 31.50 · Jo paid · by item',
      '   Beer 15.00 · Jo ×2, Sam',
      '   Nachos 9.50 · everyone',
      '   Item 4.00 · Kai',
      '   Service / tax / tip 3.00',
    ]);
  });
});
