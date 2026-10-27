import { LogDay } from '../types';

/** Local calendar-day helpers. Every function treats 'YYYY-MM-DD' as a local date, never UTC. */

export function toISODay(d: Date): LogDay {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local midnight for a 'YYYY-MM-DD' string (extra characters are ignored). */
export function parseISODay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function utcDayNumber(day: LogDay): number {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

/** Whole days from a to b (b − a). Immune to DST changes. */
export function daysBetween(a: LogDay, b: LogDay): number {
  return Math.round(utcDayNumber(b) - utcDayNumber(a));
}

export function addDays(day: LogDay, n: number): LogDay {
  const d = parseISODay(day);
  d.setDate(d.getDate() + n);
  return toISODay(d);
}

export function todayDay(now: Date = new Date()): LogDay {
  return toISODay(now);
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1));
}

export function formatDay(day: LogDay, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  return parseISODay(day).toLocaleDateString('en-US', opts);
}
