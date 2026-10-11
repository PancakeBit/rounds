import { describe, it, expect } from 'vitest';
import { nightSummary, type SummaryInput } from './summary';

const money = (m: number) => `$${(m / 100).toFixed(2)}`;
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
      'Tab: $124.00 · 4 rounds',
      '',
      'Rounds',
      '🍺 Drinks $40.00 · Jo paid · everyone',
      '🍔 Pizza $60.00 · Sam paid · Jo, Sam, Mia ×2',
      '🍟 Milkshakes $16.00 · Mia paid · on me',
      '🍺 Drinks $8.00 · Kai paid · for Sam',
      '',
      'Who pays who',
      'Mia → Jo $9.00',
      'Mia → Sam $29.00 (paid)',
    ].join('\n'));
  });

  it('shows exact amounts', () => {
    const text = nightSummary({
      ...base,
      expenses: [{
        payerId: KAI, amount: 6000, category: 'food', note: '', isTreat: false,
        shares: [{ personId: SAM, weight: 1, fixed: 3000 }, { personId: JO, weight: 1 }, { personId: KAI, weight: 1 }],
      }],
    });
    expect(text).toContain('🍔 Food $60.00 · Kai paid · Sam $30.00, Jo, Kai');
    expect(text).toContain('Tab: $60.00 · 1 round');
  });

  it('handles an empty night', () => {
    expect(nightSummary(base)).toBe('Friday night · Fri 9 Oct\nTab: $0.00 · 0 rounds\n\nWho pays who\nNobody owes anybody.');
  });
});
