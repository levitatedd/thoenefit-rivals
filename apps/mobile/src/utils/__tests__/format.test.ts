import { formatDayOfMonth, formatNumber, formatPoints, formatShortDate, ordinal } from '../format';

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

describe('formatPoints', () => {
  it('shows whole points by default', () => {
    expect(formatPoints(404.51)).toBe('405');
    expect(formatPoints(1234.4)).toBe('1,234');
  });

  it.each([
    [320, '320'],
    [1234, '1,234'],
    [270.1, '270.1'],
    [201.18, '201.18'],
    [74.2, '74.2'],
    [0.05, '0.05'],
  ])('formats %p as %p', (input, expected) => {
    expect(formatPoints(input, true)).toBe(expected);
  });
});

describe('formatDayOfMonth', () => {
  it('formats a compact day label', () => {
    expect(formatDayOfMonth(new Date(2026, 10, 16))).toBe('Mon 16');
  });
});

describe('ordinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [21, '21st'],
    [23, '23rd'],
  ])('formats %p as %p', (input, expected) => {
    expect(ordinal(input)).toBe(expected);
  });
});
