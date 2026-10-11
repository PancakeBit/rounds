import type { Transfer } from './balances';
import { categoryEmoji, categoryLabel, type Category } from './categories';
import type { ShareInput } from './split';

export interface SummaryExpense {
  payerId: number;
  amount: number;
  category: Category;
  note: string;
  isTreat: boolean;
  shares: ShareInput[];
}

export interface SummaryInput {
  title: string;
  date: string; // already formatted for the reader's locale
  memberIds: number[];
  names: Map<number, string>;
  expenses: SummaryExpense[];
  paid: Transfer[];
  open: Transfer[];
  money: (minor: number) => string;
}

// How one payment was split, in words: "everyone", "for Sam", "on me", "Jo ×2 +5.00, Sam".
export function splitLabel(
  e: Pick<SummaryExpense, 'isTreat' | 'shares'>,
  memberIds: number[],
  name: (id: number) => string,
  money: (minor: number) => string,
): string {
  if (e.isTreat) return 'on me';
  const extras = e.shares.filter(s => s.extra);
  const one = (s: ShareInput) => {
    if (s.weight === 0) return `${name(s.personId)} ${money(s.extra ?? 0)}`;
    const base = s.weight > 1 ? `${name(s.personId)} ×${s.weight}` : name(s.personId);
    return s.extra ? `${base} +${money(s.extra)}` : base;
  };
  if (extras.length === 0 && e.shares.length === 1) return `for ${name(e.shares[0].personId)}`;
  if (e.shares.length === memberIds.length && e.shares.every(s => s.weight === 1)) {
    return ['everyone', ...extras.map(one)].join(', ');
  }
  return e.shares.map(one).join(', ');
}

export function nightSummary(i: SummaryInput): string {
  const name = (id: number) => i.names.get(id) ?? '?';

  const who = (e: SummaryExpense) => splitLabel(e, i.memberIds, name, i.money);

  const total = i.expenses.reduce((sum, e) => sum + e.amount, 0);
  const n = i.expenses.length;
  const lines = [`${i.title} · ${i.date}`, `Tab: ${i.money(total)} · ${n} ${n === 1 ? 'thing' : 'things'} paid for`];
  if (n > 0) {
    lines.push('', 'What got paid');
    for (const e of i.expenses) {
      lines.push(`${categoryEmoji(e.category)} ${e.note || categoryLabel(e.category)} ${i.money(e.amount)} · ${name(e.payerId)} paid · ${who(e)}`);
    }
  }
  lines.push('', 'Who pays who');
  if (i.open.length === 0 && i.paid.length === 0) lines.push('Nobody owes anybody.');
  for (const t of i.open) lines.push(`${name(t.fromId)} → ${name(t.toId)} ${i.money(t.amount)}`);
  for (const t of i.paid) lines.push(`${name(t.fromId)} → ${name(t.toId)} ${i.money(t.amount)} (paid)`);
  return lines.join('\n');
}
