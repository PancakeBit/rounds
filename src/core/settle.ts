import type { Transfer } from './balances';

interface Side { id: number; v: number }

function biggest(xs: Side[]): Side {
  return xs.reduce((best, x) => (x.v > best.v || (x.v === best.v && x.id < best.id) ? x : best));
}

// Greedy: biggest debtor pays biggest creditor. At most n-1 transfers.
export function settle(net: Map<number, number>): Transfer[] {
  const creditors: Side[] = [...net].filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const debtors: Side[] = [...net].filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const out: Transfer[] = [];
  while (creditors.length && debtors.length) {
    const c = biggest(creditors);
    const d = biggest(debtors);
    const amount = Math.min(c.v, d.v);
    out.push({ fromId: d.id, toId: c.id, amount });
    c.v -= amount;
    d.v -= amount;
    if (c.v === 0) creditors.splice(creditors.indexOf(c), 1);
    if (d.v === 0) debtors.splice(debtors.indexOf(d), 1);
  }
  return out;
}

// True when these transfers, all paid, leave everyone at exactly zero. Settle up keeps a plan that still
// does this (so a part payment doesn't reshuffle who pays whom) and only works out a new one when it doesn't.
export function stillSettles(net: Map<number, number>, transfers: Transfer[]): boolean {
  const left = new Map(net);
  for (const t of transfers) {
    if (!left.has(t.fromId) || !left.has(t.toId) || t.amount <= 0) return false;
    left.set(t.fromId, left.get(t.fromId)! + t.amount);
    left.set(t.toId, left.get(t.toId)! - t.amount);
  }
  return [...left.values()].every(v => v === 0);
}
