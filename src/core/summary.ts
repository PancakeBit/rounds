import type { Transfer } from './balances';
import { categoryEmoji, categoryLabel, type Category } from './categories';
import type { ShareInput } from './split';
import type { ItemInput } from './items';

export interface SummaryExpense {
  payerId: number;
  amount: number;
  category: Category;
  note: string;
  isTreat: boolean;
  shares: ShareInput[];
  items?: ItemInput[];
  service?: number;
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

// How one payment was split, in words: "everyone", "for Sam", "on me", "by item", "Jo ×2 +5.00, Sam".
export function splitLabel(
  e: Pick<SummaryExpense, 'isTreat' | 'shares' | 'items'>,
  memberIds: number[],
  name: (id: number) => string,
  money: (minor: number) => string,
): string {
  if (e.isTreat) return 'on me';
  if (e.items?.length) return 'by item'; // the item lines say who had what
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

// One line per item of an itemised payment: "Beer 15.00 · Jo ×2, Sam". Unclaimed reads "everyone".
export function itemLines(
  e: { items?: ItemInput[]; service?: number },
  name: (id: number) => string,
  money: (minor: number) => string,
): string[] {
  const items = e.items ?? [];
  if (items.length === 0) return [];
  const lines = items.map(it => {
    const claimed = it.claims.filter(c => c.count > 0);
    const who = claimed.length ? claimed.map(c => (c.count > 1 ? `${name(c.personId)} ×${c.count}` : name(c.personId))).join(', ') : 'everyone';
    return `${it.name || 'Item'} ${money(it.price)} · ${who}`;
  });
  if (e.service) lines.push(`Service / tax / tip ${money(e.service)}`);
  return lines;
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
      for (const l of itemLines(e, name, i.money)) lines.push(`   ${l}`);
    }
  }
  lines.push('', 'Who pays who');
  if (i.open.length === 0 && i.paid.length === 0) lines.push('Nobody owes anybody.');
  for (const t of i.open) lines.push(`${name(t.fromId)} → ${name(t.toId)} ${i.money(t.amount)}`);
  for (const t of i.paid) lines.push(`${name(t.fromId)} → ${name(t.toId)} ${i.money(t.amount)} (paid)`);
  return lines.join('\n');
}
