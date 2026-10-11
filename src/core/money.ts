// Money has no currency: amounts are plain numbers with two decimals, stored as integer hundredths.

export function parseMoney(input: string): number | null {
  const s = input.trim().replace(',', '.');
  if (s === '' || s === '.' || !/^\d*(\.\d{0,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const n = Number(whole || '0') * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(n) ? n : null;
}

export function minorToInput(minor: number): string {
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
}

// Hand-rolled rather than Intl so the output is the same on every phone: 1,250.00
export function formatMoney(minor: number): string {
  const abs = Math.abs(minor);
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${minor < 0 ? '-' : ''}${whole}.${String(abs % 100).padStart(2, '0')}`;
}
