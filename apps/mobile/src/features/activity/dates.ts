import type { DateKey, DateRange } from './types';

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number) => String(value).padStart(2, '0');

/** Formats a Date as a `YYYY-MM-DD` key in the device's local timezone. */
export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses a `YYYY-MM-DD` key into a local Date at midnight. */
export function fromDateKey(key: DateKey): Date {
  const match = DATE_KEY_PATTERN.exec(key);
  if (!match) {
    throw new Error(`Invalid date key: ${key}`);
  }
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (toDateKey(date) !== key) {
    throw new Error(`Invalid date key: ${key}`);
  }
  return date;
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** Lists every date key in the inclusive range, oldest first. */
export function listDateKeys(range: DateRange): DateKey[] {
  if (fromDateKey(range.start) > fromDateKey(range.end)) {
    throw new Error(`Range start ${range.start} is after end ${range.end}`);
  }
  const keys: DateKey[] = [];
  for (let key = range.start; key <= range.end; key = addDays(key, 1)) {
    keys.push(key);
  }
  return keys;
}

/** The last `days` days ending with (and including) the given date. */
export function lastNDays(endDate: Date, days: number): DateRange {
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(`days must be a positive integer, received ${days}`);
  }
  const end = toDateKey(endDate);
  return { start: addDays(end, -(days - 1)), end };
}

/** Fraction (0–1) of the local calendar day that has elapsed at `now`. */
export function fractionOfDayElapsed(now: Date): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return (now.getTime() - midnight.getTime()) / (nextMidnight.getTime() - midnight.getTime());
}
