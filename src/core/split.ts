export interface ShareInput {
  personId: number;
  weight: number;
  fixed?: number | null;
}

export type SplitResult = { ok: true; owed: Map<number, number> } | { ok: false; error: string };

const fail = (error: string): SplitResult => ({ ok: false, error });

// Largest-remainder split. Fixed amounts come off the top; the rest is shared by
// weight. Leftover minor units go to the largest remainders, ties by list order.
export function splitExpense(amount: number, shares: ShareInput[]): SplitResult {
  if (!Number.isSafeInteger(amount) || amount <= 0) return fail('Amount must be more than zero');
  const seen = new Set<number>();
  for (const s of shares) {
    if (seen.has(s.personId)) return fail('Each person can only appear once');
    seen.add(s.personId);
    if (!Number.isInteger(s.weight) || s.weight < 0) return fail('Shares must be whole numbers, 0 or more');
    if (s.fixed != null && (!Number.isSafeInteger(s.fixed) || s.fixed < 0)) return fail('Fixed amounts must be 0 or more');
  }

  const fixedSum = shares.reduce((t, s) => t + (s.fixed ?? 0), 0);
  if (fixedSum > amount) return fail('Fixed amounts exceed the bill');
  const rest = amount - fixedSum;
  const weighted = shares.filter(s => s.fixed == null && s.weight > 0);
  if (rest > 0 && weighted.length === 0) return fail('Nobody is splitting the rest');

  const totalWeight = weighted.reduce((t, s) => t + s.weight, 0);
  const parts = weighted.map((s, index) => {
    const exact = rest * s.weight;
    const rem = exact % totalWeight;
    return { id: s.personId, index, floor: (exact - rem) / totalWeight, rem };
  });
  const floorOf = new Map(parts.map(p => [p.id, p.floor]));

  const owed = new Map<number, number>();
  for (const s of shares) {
    if (s.fixed != null) owed.set(s.personId, s.fixed);
    else if (s.weight > 0) owed.set(s.personId, floorOf.get(s.personId)!);
  }

  let leftover = rest - parts.reduce((t, p) => t + p.floor, 0);
  for (const p of [...parts].sort((a, b) => b.rem - a.rem || a.index - b.index)) {
    if (leftover === 0) break;
    owed.set(p.id, owed.get(p.id)! + 1);
    leftover--;
  }
  return { ok: true, owed };
}
