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
 * Points for display. Scores are kept to the hundredth; screens show whole points
 * (404.51 → "405") unless `precise` is set, which shows up to two decimals (270.1 → "270.1"),
 * e.g. to tell apart two different scores that round to the same whole number.
 */
export function formatPoints(points: number, precise = false): string {
  if (!precise) return formatNumber(points);
  const hundredths = Math.round(points * 100);
  const whole = Math.trunc(hundredths / 100);
  const fraction = Math.abs(hundredths % 100);
  if (fraction === 0) return formatNumber(whole);
  const decimals = String(fraction).padStart(2, '0').replace(/0$/, '');
  const sign = hundredths < 0 && whole === 0 ? '-' : '';
  return `${sign}${formatNumber(whole)}.${decimals}`;
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
