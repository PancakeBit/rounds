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
