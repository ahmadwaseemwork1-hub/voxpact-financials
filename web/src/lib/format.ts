import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

let CURRENCY = 'USD';
export function setCurrency(code: string) {
  CURRENCY = code || 'USD';
}
export function getCurrency() {
  return CURRENCY;
}

export function formatCurrency(value: number | null | undefined, opts: { compact?: boolean; decimals?: number } = {}) {
  const amount = Number(value ?? 0);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: CURRENCY,
      notation: opts.compact ? 'compact' : 'standard',
      maximumFractionDigits: opts.decimals ?? (opts.compact ? 1 : 2),
      minimumFractionDigits: opts.compact ? 0 : (opts.decimals ?? 2),
    }).format(amount);
  } catch {
    return `${CURRENCY} ${amount.toFixed(2)}`;
  }
}

export function formatNumber(value: number | null | undefined, decimals = 0) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(Number(value ?? 0));
}

export function formatPercent(value: number | null | undefined, decimals = 1) {
  return `${Number(value ?? 0).toFixed(decimals)}%`;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === 'string' ? parseISO(value) : value;
  return isValid(date) ? date : null;
}

export function formatDate(value: string | Date | null | undefined, pattern = 'dd MMM yyyy') {
  const date = toDate(value);
  return date ? format(date, pattern) : '—';
}

export function formatDateTime(value: string | Date | null | undefined) {
  const date = toDate(value);
  return date ? format(date, 'dd MMM yyyy, HH:mm') : '—';
}

export function formatRelative(value: string | Date | null | undefined) {
  const date = toDate(value);
  return date ? `${formatDistanceToNowStrict(date)} ago` : '—';
}

/** yyyy-MM-dd for <input type="date"> */
export function toInputDate(value: string | Date | null | undefined) {
  const date = toDate(value) ?? null;
  return date ? format(date, 'yyyy-MM-dd') : '';
}

export function todayInput() {
  return format(new Date(), 'yyyy-MM-dd');
}
