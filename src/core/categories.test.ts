import { describe, it, expect } from 'vitest';
import { CATEGORIES, categoriesEmoji, categoriesLabel, categoryEmoji, categoryLabel, joinCategories, parseCategories } from './categories';

describe('categories', () => {
  it('has the six quick-add categories in order', () => {
    expect(CATEGORIES.map(c => c.key)).toEqual(['drinks', 'food', 'taxi', 'entry', 'snacks', 'other']);
  });
  it('looks up emoji and label', () => {
    expect(categoryEmoji('drinks')).toBe('🍺');
    expect(categoryLabel('taxi')).toBe('Taxi');
  });
});

describe('several categories on one payment', () => {
  it('reads what is stored, keeping order and dropping junk and repeats', () => {
    expect(parseCategories('drinks')).toEqual(['drinks']);
    expect(parseCategories('food,drinks')).toEqual(['food', 'drinks']);
    expect(parseCategories('food,nope,food')).toEqual(['food']);
    expect(parseCategories('')).toEqual(['other']);
  });
  it('writes them back the same way', () => {
    expect(joinCategories(['food', 'drinks'])).toBe('food,drinks');
    expect(parseCategories(joinCategories(['taxi', 'entry']))).toEqual(['taxi', 'entry']);
  });
  it('shows every emoji and joins the labels', () => {
    expect(categoriesEmoji(['drinks', 'food'])).toBe('🍺🍔');
    expect(categoriesLabel(['drinks'])).toBe('Drinks');
    expect(categoriesLabel(['drinks', 'food'])).toBe('Drinks & Food');
    expect(categoriesLabel(['drinks', 'food', 'taxi'])).toBe('Drinks, Food & Taxi');
  });
});
