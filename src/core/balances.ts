import { splitExpense, type ShareInput } from './split';

export interface ExpenseLike {
  payerId: number;
  amount: number;
  shares: ShareInput[];
}

export interface Transfer {
  fromId: number;
  toId: number;
  amount: number;
}

// net = paid - owed, adjusted for transfers already handed over.
export function nightBalances(memberIds: number[], expenses: ExpenseLike[], paid: Transfer[] = []): Map<number, number> {
  const net = new Map<number, number>(memberIds.map(id => [id, 0]));
  const add = (id: number, delta: number) => net.set(id, (net.get(id) ?? 0) + delta);

  for (const e of expenses) {
    const r = splitExpense(e.amount, e.shares);
    if (!r.ok) throw new Error(`Stored expense is invalid: ${r.error}`);
    add(e.payerId, e.amount);
    for (const [id, owed] of r.owed) add(id, -owed);
  }
  for (const t of paid) {
    add(t.fromId, t.amount);
    add(t.toId, -t.amount);
  }

  const total = [...net.values()].reduce((a, b) => a + b, 0);
  if (total !== 0) throw new Error(`Balances do not sum to zero (${total})`);
  return net;
}

// Running balance per member: starts at 0, one entry per round that moved it, one more for paid transfers.
export function balanceHistory(memberIds: number[], expenses: ExpenseLike[], paid: Transfer[] = []): Map<number, number[]> {
  const hist = new Map<number, number[]>(memberIds.map(id => [id, [0]]));
  const apply = (deltas: Map<number, number>) => {
    for (const [id, d] of deltas) {
      if (d === 0) continue;
      const h = hist.get(id) ?? [0];
      h.push(h[h.length - 1] + d);
      hist.set(id, h);
    }
  };
  for (const e of expenses) {
    const r = splitExpense(e.amount, e.shares);
    if (!r.ok) throw new Error(`Stored expense is invalid: ${r.error}`);
    const deltas = new Map<number, number>([[e.payerId, e.amount]]);
    for (const [id, owed] of r.owed) deltas.set(id, (deltas.get(id) ?? 0) - owed);
    apply(deltas);
  }
  if (paid.length > 0) {
    const deltas = new Map<number, number>();
    for (const t of paid) {
      deltas.set(t.fromId, (deltas.get(t.fromId) ?? 0) + t.amount);
      deltas.set(t.toId, (deltas.get(t.toId) ?? 0) - t.amount);
    }
    apply(deltas);
  }
  return hist;
}
