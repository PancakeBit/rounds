import { describe, it, expect } from 'vitest';
import { CATEGORIES, categoryEmoji, categoryLabel } from './categories';

describe('categories', () => {
  it('has the six quick-add categories in order', () => {
    expect(CATEGORIES.map(c => c.key)).toEqual(['drinks', 'food', 'taxi', 'entry', 'snacks', 'other']);
  });
  it('looks up emoji and label', () => {
    expect(categoryEmoji('drinks')).toBe('🍺');
    expect(categoryLabel('taxi')).toBe('Taxi');
  });
});
