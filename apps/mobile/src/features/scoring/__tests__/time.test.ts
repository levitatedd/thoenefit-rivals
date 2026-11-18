import { addDays, datesBetween, dayOf, startOfDay } from '../time';

const ms = (iso: string) => Date.parse(iso);

describe('competition calendar', () => {
  it('assigns instants to the local day of the competition time zone', () => {
    expect(dayOf(ms('2026-11-03T05:59:59Z'), 'America/Chicago')).toBe('2026-11-02');
    expect(dayOf(ms('2026-11-03T06:00:00Z'), 'America/Chicago')).toBe('2026-11-03');
    expect(dayOf(ms('2026-11-02T18:30:00Z'), 'Asia/Kolkata')).toBe('2026-11-03'); // UTC+5:30
    expect(dayOf(ms('2026-11-02T10:59:59Z'), 'Pacific/Auckland')).toBe('2026-11-02'); // UTC+13
    expect(dayOf(ms('2026-11-02T11:00:00Z'), 'Pacific/Auckland')).toBe('2026-11-03');
  });

  it('finds local midnight, including half-hour offsets', () => {
    expect(new Date(startOfDay('2026-11-02', 'America/Chicago')).toISOString()).toBe(
      '2026-11-02T06:00:00.000Z',
    );
    expect(new Date(startOfDay('2026-11-03', 'Asia/Kolkata')).toISOString()).toBe(
      '2026-11-02T18:30:00.000Z',
    );
  });

  it('handles daylight-saving transitions (23- and 25-hour days)', () => {
    const tz = 'America/Chicago';
    const springDay = startOfDay('2026-03-09', tz) - startOfDay('2026-03-08', tz);
    const fallDay = startOfDay('2026-11-02', tz) - startOfDay('2026-11-01', tz);
    expect(springDay).toBe(23 * 3600 * 1000);
    expect(fallDay).toBe(25 * 3600 * 1000);
    // 23:30 local on the 25-hour day is still that day.
    expect(dayOf(ms('2026-11-02T05:30:00Z'), tz)).toBe('2026-11-01');
  });

  it('lists dates inclusively and rejects bad input', () => {
    expect(datesBetween('2026-11-02', '2026-11-04')).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
    ]);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(() => datesBetween('2026-11-04', '2026-11-02')).toThrow();
    expect(() => startOfDay('2026-02-30', 'America/Chicago')).toThrow('Invalid date key');
    expect(() => dayOf(0, 'Mars/Olympus')).toThrow();
  });
});
