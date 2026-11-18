import {
  addDays,
  fractionOfDayElapsed,
  fromDateKey,
  lastNDays,
  listDateKeys,
  toDateKey,
} from '../dates';

describe('date helpers', () => {
  it('round-trips local date keys', () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toDateKey(fromDateKey('2026-02-28'))).toBe('2026-02-28');
  });

  it('rejects malformed or impossible date keys', () => {
    expect(() => fromDateKey('2026-1-5')).toThrow('Invalid date key');
    expect(() => fromDateKey('2026-02-30')).toThrow('Invalid date key');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('lists an inclusive range oldest first', () => {
    expect(listDateKeys({ start: '2026-11-15', end: '2026-11-18' })).toEqual([
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
    ]);
    expect(() => listDateKeys({ start: '2026-11-18', end: '2026-11-15' })).toThrow();
  });

  it('builds a trailing window that includes the end date', () => {
    expect(lastNDays(new Date(2026, 10, 18, 9), 7)).toEqual({
      start: '2026-11-12',
      end: '2026-11-18',
    });
    expect(() => lastNDays(new Date(), 0)).toThrow();
  });

  it('computes the elapsed fraction of the local day', () => {
    expect(fractionOfDayElapsed(new Date(2026, 10, 18, 0, 0))).toBe(0);
    expect(fractionOfDayElapsed(new Date(2026, 10, 18, 12, 0))).toBeCloseTo(0.5, 2);
  });
});
