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
