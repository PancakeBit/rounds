export const CATEGORIES = [
  { key: 'drinks', emoji: '🍺', label: 'Drinks' },
  { key: 'food', emoji: '🍔', label: 'Food' },
  { key: 'taxi', emoji: '🚕', label: 'Taxi' },
  { key: 'entry', emoji: '🎟️', label: 'Entry' },
  { key: 'snacks', emoji: '🍟', label: 'Snacks' },
  { key: 'other', emoji: '✨', label: 'Other' },
] as const;

export type Category = (typeof CATEGORIES)[number]['key'];

export function categoryEmoji(c: Category): string {
  return CATEGORIES.find(x => x.key === c)?.emoji ?? '✨';
}

export function categoryLabel(c: Category): string {
  return CATEGORIES.find(x => x.key === c)?.label ?? 'Other';
}

// A payment can be for several things ("drinks and food"). Stored comma-separated in one column;
// a single old value reads as a list of one.
const KEYS = new Set<string>(CATEGORIES.map(c => c.key));

export function parseCategories(stored: string): Category[] {
  const out: Category[] = [];
  for (const k of stored.split(',')) if (KEYS.has(k) && !out.includes(k as Category)) out.push(k as Category);
  return out.length ? out : ['other'];
}

export function joinCategories(cs: Category[]): string {
  return cs.join(',');
}

export function categoriesEmoji(cs: Category[]): string {
  return cs.map(categoryEmoji).join('');
}

export function categoriesLabel(cs: Category[]): string {
  const labels = cs.map(categoryLabel);
  return labels.length <= 1 ? labels[0] ?? 'Other' : `${labels.slice(0, -1).join(', ')} & ${labels.at(-1)}`;
}
