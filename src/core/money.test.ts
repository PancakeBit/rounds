import { describe, it, expect } from 'vitest';
import { minorDigits, parseMoney, minorToInput, formatMoney, isCurrencyCode } from './money';

describe('minorDigits', () => {
  it('USD has 2, JPY has 0', () => {
    expect(minorDigits('USD')).toBe(2);
    expect(minorDigits('JPY')).toBe(0);
  });
});

describe('parseMoney', () => {
  it.each([
    ['12', 1200], ['12.5', 1250], ['12.50', 1250], ['12,5', 1250],
    ['.5', 50], ['0.01', 1], [' 7 ', 700], ['5.', 500], ['0', 0],
  ])('USD %s -> %i', (s, n) => {
    expect(parseMoney(s, 'USD')).toBe(n);
  });
  it.each(['', '.', 'abc', '1.234', '1.2.3', '-5', '1e3', '1,234.50'])('USD rejects %j', s => {
    expect(parseMoney(s, 'USD')).toBeNull();
  });
  it('JPY has no decimals', () => {
    expect(parseMoney('500', 'JPY')).toBe(500);
    expect(parseMoney('5.5', 'JPY')).toBeNull();
  });
});

describe('minorToInput', () => {
  it('round-trips through parseMoney', () => {
    expect(minorToInput(1250, 'USD')).toBe('12.50');
    expect(minorToInput(5, 'USD')).toBe('0.05');
    expect(minorToInput(500, 'JPY')).toBe('500');
    expect(parseMoney(minorToInput(98765, 'USD'), 'USD')).toBe(98765);
  });
});

describe('formatMoney', () => {
  it('formats minor units', () => {
    expect(formatMoney(1250, 'USD', 'en-US')).toBe('$12.50');
    expect(formatMoney(500, 'JPY', 'en-US')).toBe('¥500');
  });
});

describe('isCurrencyCode', () => {
  it('accepts 3 uppercase letters only', () => {
    expect(isCurrencyCode('USD')).toBe(true);
    expect(isCurrencyCode('PHP')).toBe(true);
    expect(isCurrencyCode('usd')).toBe(false);
    expect(isCurrencyCode('US')).toBe(false);
    expect(isCurrencyCode('12A')).toBe(false);
  });
});
