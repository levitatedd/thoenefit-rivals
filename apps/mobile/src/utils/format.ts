/** Formats an integer with thousands separators, e.g. 12345 → "12,345". */
export function formatNumber(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Short local label such as "Mon, Nov 17". */
export function formatShortDate(date: Date): string {
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Points for display, always rounded to the nearest whole number (404.51 → "405").
 * Scoring and ranking still use exact hundredths (see docs/SCORING.md).
 */
export function formatPoints(points: number): string {
  return formatNumber(points);
}

/** Compact day label such as "Mon 16". */
export function formatDayOfMonth(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}`;
}

/** 1 → "1st", 2 → "2nd", 11 → "11th", 23 → "23rd". */
export function ordinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const suffix = ['th', 'st', 'nd', 'rd'][value % 10] ?? 'th';
  return `${value}${suffix}`;
}
