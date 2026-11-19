import { CurrencyMode } from './types';

export function toPersianDigits(val: string | number): string {
  const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(val).replace(/\d/g, (d) => persian[parseInt(d, 10)]);
}

export function formatMoney(
  rialAmount: number | null | undefined,
  mode: CurrencyMode = 'rial',
  usePersianDigits = true
): string {
  if (rialAmount === null || rialAmount === undefined || isNaN(rialAmount)) {
    return 'استعلام روز';
  }
  if (rialAmount === 0) {
    return usePersianDigits ? '۰' : '0';
  }
  const value = mode === 'toman' ? Math.round(rialAmount / 10) : Math.round(rialAmount);
  const formatted = value.toLocaleString('en-US');
  return usePersianDigits ? toPersianDigits(formatted) : formatted;
}

export function currencyLabel(mode: CurrencyMode): string {
  return mode === 'toman' ? 'تومان' : 'ریال';
}

/**
 * Normalizes Persian/Arabic digits to English digits and strips non-numeric chars,
 * then formats with 3-digit comma separators (e.g. 25000000 -> "25,000,000")
 */
export function normalizeDigitsToEnglish(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

export function formatNumberInputWithCommas(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '';
  const raw = normalizeDigitsToEnglish(String(val)).replace(/[^0-9]/g, '');
  if (!raw) return '';
  const num = Number(raw);
  if (isNaN(num) || num === 0) return raw === '0' ? '0' : '';
  return num.toLocaleString('en-US');
}

export function parseCommaFormattedNumber(input: string): number {
  const cleaned = normalizeDigitsToEnglish(input).replace(/[^0-9]/g, '');
  if (!cleaned) return 0;
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Exact VBA UserForm4 formula from List PC.xlsm:
 * e = ((a - b) * (c * 12) * (D + 1)) / 2400
 * f = ((a - b) + e) / D
 */
export function calculateInstallmentVBA(
  totalRial: number,
  cashPaymentRial: number,
  monthlyRatePercent: number,
  monthsCount: number
) {
  const a = Math.max(0, Number(totalRial) || 0);
  const b = Math.min(a, Math.max(0, Number(cashPaymentRial) || 0));
  const c = Math.max(0, Number(monthlyRatePercent) || 0);
  const D = Math.max(1, Math.floor(Number(monthsCount) || 1));

  const remaining = a - b;
  const e = (remaining * (c * 12) * (D + 1)) / 2400;
  const f = (remaining + e) / D;

  return {
    remainingPrincipal: Math.round(remaining),
    totalInterest: Math.round(e),
    monthlyInstallment: Math.round(f),
    totalPayableWithInterest: Math.round(b + remaining + e),
  };
}

export function getPersianDateTime(): { date: string; time: string } {
  const now = new Date();
  try {
    const date = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    const time = new Intl.DateTimeFormat('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now);
    return { date, time };
  } catch {
    return {
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 8),
    };
  }
}

export function colIndexToLetter(col: number): string {
  let temp = 0;
  let letter = '';
  let c = col;
  while (c > 0) {
    temp = (c - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    c = (c - temp - 1) / 26;
  }
  return letter;
}
