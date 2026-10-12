import { nightBalances, type ExpenseLike, type Transfer } from './balances';
import { settle, stillSettles } from './settle';

// Everything still owed across all open nights, people first. Each night still settles on its own;
// this only adds the nights up so the home screen can say where each person stands.

export interface OpenNightData {
  nightId: number;
  title: string;
  memberIds: number[];
  expenses: ExpenseLike[];
  paid: Transfer[]; // ticked off on Settle up
  unpaid: Transfer[]; // the plan Settle up last showed, kept if it still squares everyone
}

export interface PairPiece { nightId: number; title: string; fromId: number; toId: number; amount: number }
export interface PairDebt { fromId: number; toId: number; amount: number; pieces: PairPiece[] }

export interface Across {
  net: Map<number, number>; // per person: positive = gets money back, negative = owes
  pairs: PairDebt[]; // one per pair of people, netted across nights, biggest first
}

// What each night still needs moved: the plan Settle up shows if it still holds, else a fresh one.
export function nightTransfers(n: OpenNightData): Transfer[] {
  const net = nightBalances(n.memberIds, n.expenses, n.paid);
  return stillSettles(net, n.unpaid) ? n.unpaid : settle(net);
}

export function across(nights: OpenNightData[]): Across {
  const net = new Map<number, number>();
  const byPair = new Map<string, { a: number; b: number; aOwesB: number; pieces: PairPiece[] }>();
  for (const n of nights) {
    for (const t of nightTransfers(n)) {
      net.set(t.fromId, (net.get(t.fromId) ?? 0) - t.amount);
      net.set(t.toId, (net.get(t.toId) ?? 0) + t.amount);
      const [a, b] = t.fromId < t.toId ? [t.fromId, t.toId] : [t.toId, t.fromId];
      const key = `${a}:${b}`;
      const p = byPair.get(key) ?? { a, b, aOwesB: 0, pieces: [] };
      p.aOwesB += t.fromId === a ? t.amount : -t.amount;
      p.pieces.push({ nightId: n.nightId, title: n.title, fromId: t.fromId, toId: t.toId, amount: t.amount });
      byPair.set(key, p);
    }
  }
  const pairs: PairDebt[] = [...byPair.values()]
    .filter(p => p.aOwesB !== 0)
    .map(p => (p.aOwesB > 0
      ? { fromId: p.a, toId: p.b, amount: p.aOwesB, pieces: p.pieces }
      : { fromId: p.b, toId: p.a, amount: -p.aOwesB, pieces: p.pieces }))
    .sort((x, y) => y.amount - x.amount);
  return { net, pairs };
}
