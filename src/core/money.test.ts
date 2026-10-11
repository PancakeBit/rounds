import { describe, it, expect } from 'vitest';
import { parseMoney, minorToInput, formatMoney } from './money';

describe('parseMoney', () => {
  it.each([
    ['12', 1200], ['12.5', 1250], ['12.50', 1250], ['12,5', 1250],
    ['.5', 50], ['0.01', 1], [' 7 ', 700], ['5.', 500], ['0', 0],
  ])('%s -> %i', (s, n) => {
    expect(parseMoney(s)).toBe(n);
  });
  it.each(['', '.', 'abc', '1.234', '1.2.3', '-5', '1e3', '1,234.50'])('rejects %j', s => {
    expect(parseMoney(s)).toBeNull();
  });
});

describe('minorToInput', () => {
  it('round-trips through parseMoney', () => {
    expect(minorToInput(1250)).toBe('12.50');
    expect(minorToInput(5)).toBe('0.05');
    expect(parseMoney(minorToInput(98765))).toBe(98765);
  });
});

describe('formatMoney', () => {
  it('is a plain number with grouping and two decimals, no symbol', () => {
    expect(formatMoney(0)).toBe('0.00');
    expect(formatMoney(5)).toBe('0.05');
    expect(formatMoney(1250)).toBe('12.50');
    expect(formatMoney(125000)).toBe('1,250.00');
    expect(formatMoney(999999999)).toBe('9,999,999.99');
  });
  it('negative numbers keep the sign in front', () => {
    expect(formatMoney(-125000)).toBe('-1,250.00');
  });
});
