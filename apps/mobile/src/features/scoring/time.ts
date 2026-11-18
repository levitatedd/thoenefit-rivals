import type { DateKey, Instant } from './types';

/**
 * Calendar handling in a single declared competition time zone, including daylight-saving
 * transitions. Competition days are half-open intervals [local 00:00, next local 00:00).
 */

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    // Throws RangeError for an unknown time zone, which is what we want.
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

function localParts(epochMs: number, timeZone: string) {
  const parts: Record<string, number> = {};
  for (const p of formatterFor(timeZone).formatToParts(new Date(epochMs))) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return parts as {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  };
}

export function parseInstant(instant: Instant): number {
  const ms = Date.parse(instant);
  if (!Number.isFinite(ms)) throw new Error(`Invalid instant: ${instant}`);
  return ms;
}

export function toInstant(epochMs: number): Instant {
  return new Date(epochMs).toISOString();
}

export function assertDateKey(key: DateKey): { year: number; month: number; day: number } {
  const match = DATE_KEY.exec(key);
  if (!match) throw new Error(`Invalid date key: ${key}`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new Error(`Invalid date key: ${key}`);
  }
  return { year, month, day };
}

/** Local calendar date of an instant in the given time zone. */
export function dayOf(epochMs: number, timeZone: string): DateKey {
  const p = localParts(epochMs, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * The first instant of `date` in `timeZone` (local midnight, or the first existing local time
 * if a DST change skips midnight). Found by binary search, so it is correct for any zone.
 */
export function startOfDay(date: DateKey, timeZone: string): number {
  const { year, month, day } = assertDateKey(date);
  const naive = Date.UTC(year, month - 1, day);
  // Real UTC offsets are within ±14 h; search a window that is guaranteed to contain the boundary.
  let lo = naive - 15 * 3600 * 1000; // definitely before the date starts
  let hi = naive + 15 * 3600 * 1000; // definitely on or after it
  while (hi - lo > 1000) {
    const mid = lo + Math.floor((hi - lo) / 2000) * 1000;
    if (dayOf(mid, timeZone) >= date) hi = mid;
    else lo = mid;
  }
  return hi;
}

export function addDays(date: DateKey, days: number): DateKey {
  const { year, month, day } = assertDateKey(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}

/** All dates from start to end inclusive. */
export function datesBetween(start: DateKey, end: DateKey): DateKey[] {
  assertDateKey(start);
  assertDateKey(end);
  if (start > end) throw new Error(`Start ${start} is after end ${end}`);
  const dates: DateKey[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) dates.push(d);
  return dates;
}
