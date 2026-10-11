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

export function nightSummary(i: SummaryInput): string {
  const name = (id: number) => i.names.get(id) ?? '?';

  const who = (e: SummaryExpense): string => {
    if (e.isTreat) return 'on me';
    const plain = e.shares.every(s => s.fixed == null);
    if (plain && e.shares.length === 1) return `for ${name(e.shares[0].personId)}`;
    if (plain && e.shares.length === i.memberIds.length && e.shares.every(s => s.weight === 1)) return 'everyone';
    return e.shares
      .map(s => (s.fixed != null ? `${name(s.personId)} ${i.money(s.fixed)}` : s.weight > 1 ? `${name(s.personId)} ×${s.weight}` : name(s.personId)))
      .join(', ');
  };

  const total = i.expenses.reduce((sum, e) => sum + e.amount, 0);
  const n = i.expenses.length;
  const lines = [`${i.title} · ${i.date}`, `Tab: ${i.money(total)} · ${n} ${n === 1 ? 'round' : 'rounds'}`];
  if (n > 0) {
    lines.push('', 'Rounds');
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
