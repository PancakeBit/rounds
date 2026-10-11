export interface ShareInput {
  personId: number;
  weight: number;
  extra?: number | null; // added on top of their share: something only they had
}

export type SplitResult = { ok: true; owed: Map<number, number> } | { ok: false; error: string };

const fail = (error: string): SplitResult => ({ ok: false, error });

// Largest-remainder split. Extras come off the top and go to whoever had them; the rest is
// shared by weight among everyone in. Leftover minor units go to the largest remainders, ties by list order.
export function splitExpense(amount: number, shares: ShareInput[]): SplitResult {
  if (!Number.isSafeInteger(amount) || amount <= 0) return fail('Amount must be more than zero');
  const seen = new Set<number>();
  for (const s of shares) {
    if (seen.has(s.personId)) return fail('Each person can only appear once');
    seen.add(s.personId);
    if (!Number.isInteger(s.weight) || s.weight < 0) return fail('Shares must be whole numbers, 0 or more');
    if (s.extra != null && (!Number.isSafeInteger(s.extra) || s.extra < 0)) return fail('Extras must be 0 or more');
  }

  const extraSum = shares.reduce((t, s) => t + (s.extra ?? 0), 0);
  if (extraSum > amount) return fail('Extras add up to more than the bill');
  const rest = amount - extraSum;
  const weighted = shares.filter(s => s.weight > 0);
  if (rest > 0 && weighted.length === 0) return fail('Nobody is sharing the rest');

  const totalWeight = weighted.reduce((t, s) => t + s.weight, 0);
  const parts = weighted.map((s, index) => {
    const exact = rest * s.weight;
    const rem = exact % totalWeight;
    return { id: s.personId, index, floor: (exact - rem) / totalWeight, rem };
  });
  const floorOf = new Map(parts.map(p => [p.id, p.floor]));

  const owed = new Map<number, number>();
  for (const s of shares) {
    if (s.weight > 0 || s.extra) owed.set(s.personId, (s.extra ?? 0) + (floorOf.get(s.personId) ?? 0));
  }

  let leftover = rest - parts.reduce((t, p) => t + p.floor, 0);
  for (const p of [...parts].sort((a, b) => b.rem - a.rem || a.index - b.index)) {
    if (leftover === 0) break;
    owed.set(p.id, owed.get(p.id)! + 1);
    leftover--;
  }
  return { ok: true, owed };
}
