import { formatNumber, formatShortDate } from '../format';

describe('formatNumber', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1,000'],
    [12345.6, '12,346'],
    [-1234567, '-1,234,567'],
  ])('formats %p as %p', (input, expected) => {
    expect(formatNumber(input)).toBe(expected);
  });
});

describe('formatShortDate', () => {
  it('formats a local date', () => {
    expect(formatShortDate(new Date(2026, 10, 18))).toBe('Wed, Nov 18');
  });
});
