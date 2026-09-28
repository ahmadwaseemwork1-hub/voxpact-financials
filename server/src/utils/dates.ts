/** Date helpers — all boundaries are computed in the server's local timezone. */

export function startOfDay(d: Date | string = new Date()): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(d: Date | string = new Date()): Date {
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date;
}

/** UTC midnight — used for the @db.Date columns so keys are stable. */
export function dateKey(d: Date | string = new Date()): Date {
  const date = new Date(d);
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

export function startOfMonth(d: Date | string = new Date()): Date {
  const date = new Date(d);
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(d: Date | string = new Date()): Date {
  const date = new Date(d);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** ISO week start (Monday). */
export function startOfWeek(d: Date | string = new Date()): Date {
  const date = startOfDay(d);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return date;
}

export function endOfWeek(d: Date | string = new Date()): Date {
  const date = startOfWeek(d);
  date.setDate(date.getDate() + 6);
  return endOfDay(date);
}

export function addDays(d: Date | string, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

export function addMonths(d: Date | string, n: number): Date {
  const date = new Date(d);
  date.setMonth(date.getMonth() + n);
  return date;
}

export function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Parse `?from=&to=` query params, defaulting to the current month. */
export function parseRange(query: Record<string, unknown>) {
  const from = query.from ? startOfDay(String(query.from)) : startOfMonth();
  const to = query.to ? endOfDay(String(query.to)) : endOfDay();
  return { from, to };
}
