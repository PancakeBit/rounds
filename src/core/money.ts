export function minorDigits(currency: string): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

export function parseMoney(input: string, currency: string): number | null {
  const digits = minorDigits(currency);
  const s = input.trim().replace(',', '.');
  if (s === '' || s === '.' || !/^\d*(\.\d*)?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  if (frac.length > digits) return null;
  const n = Number(whole || '0') * 10 ** digits + Number(frac.padEnd(digits, '0') || '0');
  return Number.isSafeInteger(n) ? n : null;
}

export function minorToInput(minor: number, currency: string): string {
  const digits = minorDigits(currency);
  if (digits === 0) return String(minor);
  const unit = 10 ** digits;
  return `${Math.floor(minor / unit)}.${String(minor % unit).padStart(digits, '0')}`;
}

export function formatMoney(minor: number, currency: string, locale?: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 10 ** minorDigits(currency));
}

export function isCurrencyCode(code: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) return false;
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: code });
    return true;
  } catch {
    return false;
  }
}
