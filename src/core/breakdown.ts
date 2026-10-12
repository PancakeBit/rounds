import type { ExpenseLike } from './balances';
import { categoriesLabel, type Category } from './categories';
import { itemsStillMatch, splitItems, type ItemInput } from './items';
import { splitExpense } from './split';

export interface BreakdownExpense extends ExpenseLike {
  note: string;
  categories: Category[];
  isTreat: boolean;
  items?: ItemInput[];
  service?: number;
}

export interface PersonBreakdown {
  total: number;
  lines: { label: string; amount: number; payerId: number }[]; // payerId: who paid for that line
}

// "Who had what": for each person, what their share of the night is made of, across every payment.
// Itemised payments list each item (and that payment's service); plain ones list the payment itself.
// A treat counts towards whoever paid. Everyone's totals add up to the whole tab.
export function whoHadWhat(expenses: BreakdownExpense[], memberIds: number[]): Map<number, PersonBreakdown> {
  const acc = new Map<number, PersonBreakdown>();
  const add = (p: number, label: string, amount: number, payerId: number) => {
    if (amount <= 0) return;
    const b = acc.get(p) ?? { total: 0, lines: [] };
    b.total += amount;
    b.lines.push({ label, amount, payerId });
    acc.set(p, b);
  };

  for (const e of expenses) {
    const title = e.note || categoriesLabel(e.categories);
    if (e.isTreat) {
      add(e.payerId, `${title} (on me)`, e.amount, e.payerId);
      continue;
    }
    const items = e.items ?? [];
    const r = items.length ? splitItems(items, e.service ?? 0, memberIds) : null;
    if (r?.ok && itemsStillMatch(r, e.shares)) {
      items.forEach((it, i) => {
        for (const [p, amt] of r.perItem[i]) {
          const count = it.claims.find(c => c.personId === p)?.count ?? 1;
          add(p, `${it.name || `Item ${i + 1}`}${count > 1 ? ` ×${count}` : ''}`, amt, e.payerId);
        }
      });
      for (const [p, amt] of r.service) add(p, `${title} service`, amt, e.payerId);
      continue;
    }
    // Plain payments, and the stored shares as a fallback if the items no longer split (members changed).
    const s = splitExpense(e.amount, e.shares);
    if (s.ok) for (const [p, amt] of s.owed) add(p, title, amt, e.payerId);
  }

  const order = [...memberIds, ...[...acc.keys()].filter(p => !memberIds.includes(p))];
  return new Map(order.filter(p => acc.has(p)).map(p => [p, acc.get(p)!]));
}
