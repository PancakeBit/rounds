import type { ExpenseLike } from './balances';
import type { Category } from './categories';
import { splitExpense } from './split';

export interface StatExpense extends ExpenseLike {
  categories: Category[];
  isTreat: boolean;
  createdAt: number;
}

export interface Leader {
  personId: number;
  amount: number;
}

export interface NightStats {
  total: number;
  rounds: number;
  byCategory: { category: Category; amount: number }[];
  topCategory: Category | null;
  bigSpender: Leader | null;
  mostGenerous: Leader | null;
  sponge: Leader | null;
  longestGapMs: number | null;
}

function bump<K>(m: Map<K, number>, k: K, d: number) {
  m.set(k, (m.get(k) ?? 0) + d);
}

// First to reach the top amount wins ties.
function leader(m: Map<number, number>): Leader | null {
  let best: Leader | null = null;
  for (const [personId, amount] of m) if (amount > 0 && (!best || amount > best.amount)) best = { personId, amount };
  return best;
}

export function nightStats(expenses: StatExpense[]): NightStats {
  const paid = new Map<number, number>();
  const treats = new Map<number, number>();
  const sponged = new Map<number, number>(); // consumed on someone else's dime
  const cats = new Map<Category, number>();
  let total = 0;

  for (const e of expenses) {
    total += e.amount;
    bump(paid, e.payerId, e.amount);
    // A payment for several things counts evenly towards each; spare cents go to the first.
    const n = e.categories.length || 1;
    e.categories.forEach((c, i) => bump(cats, c, Math.floor(e.amount / n) + (i < e.amount % n ? 1 : 0)));
    if (e.isTreat) bump(treats, e.payerId, e.amount);
    const r = splitExpense(e.amount, e.shares);
    if (r.ok) for (const [id, owed] of r.owed) if (id !== e.payerId) bump(sponged, id, owed);
  }

  const byCategory = [...cats].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  const times = expenses.map(e => e.createdAt).sort((a, b) => a - b);
  let longestGapMs: number | null = null;
  for (let i = 1; i < times.length; i++) longestGapMs = Math.max(longestGapMs ?? 0, times[i] - times[i - 1]);

  return {
    total,
    rounds: expenses.length,
    byCategory,
    topCategory: byCategory[0]?.category ?? null,
    bigSpender: leader(paid),
    mostGenerous: leader(treats),
    sponge: leader(sponged),
    longestGapMs,
  };
}

export function formatGap(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`;
}
