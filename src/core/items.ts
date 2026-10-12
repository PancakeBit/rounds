import { splitExpense, type ShareInput } from './split';

// A payment broken into items. Each item is claimed by whoever had it; tapping a name again
// gives them a bigger part (count). An item nobody claimed is shared by everyone.
export interface ItemClaim { personId: number; count: number }
export interface ItemInput { name: string; price: number; claims: ItemClaim[] }

export type ItemSplit =
  | { ok: true; owed: Map<number, number>; subtotal: number; total: number }
  | { ok: false; error: string };

const fail = (error: string) => ({ ok: false as const, error });

// Items are split one by one (largest remainder within each item). Service, tax or tip is then
// spread in proportion to what each person's items came to, so the total is always exact.
export function splitItems(items: ItemInput[], service: number, everyone: number[]): ItemSplit {
  if (items.length === 0) return fail('Add an item');
  if (!Number.isSafeInteger(service) || service < 0) return fail('Service must be 0 or more');
  const owed = new Map<number, number>();
  let subtotal = 0;
  for (const it of items) {
    if (!Number.isSafeInteger(it.price) || it.price <= 0) return fail('Every item needs a price');
    if (it.claims.some(c => !Number.isInteger(c.count) || c.count < 0)) return fail('Claims must be whole numbers');
    const claimed = it.claims.filter(c => c.count > 0);
    const shares: ShareInput[] = claimed.length
      ? claimed.map(c => ({ personId: c.personId, weight: c.count }))
      : everyone.map(personId => ({ personId, weight: 1 }));
    const r = splitExpense(it.price, shares);
    if (!r.ok) return fail(r.error);
    for (const [p, v] of r.owed) owed.set(p, (owed.get(p) ?? 0) + v);
    subtotal += it.price;
  }
  if (!Number.isSafeInteger(subtotal * Math.max(service, 1))) return fail("That's too big to split");
  if (service > 0) {
    const r = splitExpense(service, [...owed].map(([personId, v]) => ({ personId, weight: v })));
    if (!r.ok) return fail(r.error);
    for (const [p, v] of r.owed) owed.set(p, (owed.get(p) ?? 0) + v);
  }
  return { ok: true, owed, subtotal, total: subtotal + service };
}

// What gets stored: each person's item total as an exact amount with no plain share, so balances,
// Settle up and the recap read an itemised payment like any other. "On me" still means the payer covers it all.
export function itemShares(
  items: ItemInput[], service: number, everyone: number[], payerId: number, isTreat: boolean,
): { ok: true; amount: number; shares: ShareInput[] } | { ok: false; error: string } {
  const r = splitItems(items, service, everyone);
  if (!r.ok) return r;
  if (isTreat) return { ok: true, amount: r.total, shares: [{ personId: payerId, weight: 1 }] };
  const order = [...everyone, ...[...r.owed.keys()].filter(p => !everyone.includes(p))];
  const shares = order.filter(p => (r.owed.get(p) ?? 0) > 0).map(p => ({ personId: p, weight: 0, extra: r.owed.get(p)! }));
  return { ok: true, amount: r.total, shares };
}
