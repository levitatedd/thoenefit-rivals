import { SimulatedActivitySource } from '../simulated-source';

const NOON = new Date(2026, 10, 18, 12, 0, 0);
const WEEK = { start: '2026-11-12', end: '2026-11-18' };

describe('SimulatedActivitySource', () => {
  it('identifies itself as simulated', () => {
    const source = new SimulatedActivitySource();
    expect(source.info.kind).toBe('simulated');
  });

  it('returns one summary per day, oldest first', async () => {
    const source = new SimulatedActivitySource({ now: () => NOON });
    const days = await source.getDailySummaries(WEEK);
    expect(days.map((d) => d.date)).toEqual([
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
    ]);
    expect(days.every((d) => d.sourceId === 'simulated')).toBe(true);
  });

  it('is deterministic for the same seed and differs across seeds', async () => {
    const a = await new SimulatedActivitySource({ seed: 'a', now: () => NOON }).getDailySummaries(
      WEEK,
    );
    const a2 = await new SimulatedActivitySource({ seed: 'a', now: () => NOON }).getDailySummaries(
      WEEK,
    );
    const b = await new SimulatedActivitySource({ seed: 'b', now: () => NOON }).getDailySummaries(
      WEEK,
    );
    expect(a2).toEqual(a);
    expect(b).not.toEqual(a);
  });

  it('produces plausible whole-number totals', async () => {
    const source = new SimulatedActivitySource({ now: () => new Date(2027, 0, 1) });
    const days = await source.getDailySummaries({ start: '2026-01-01', end: '2026-12-31' });
    expect(days).toHaveLength(365);
    for (const day of days) {
      expect(Number.isInteger(day.steps)).toBe(true);
      expect(Number.isInteger(day.activeEnergyKcal)).toBe(true);
      expect(day.steps).toBeGreaterThanOrEqual(3000);
      expect(day.steps).toBeLessThanOrEqual(16000);
      expect(day.activeEnergyKcal).toBeGreaterThanOrEqual(150);
      expect(day.activeEnergyKcal).toBeLessThanOrEqual(950);
      expect(day.isComplete).toBe(true);
    }
  });

  it('scales today by time elapsed and marks it incomplete', async () => {
    const atMidnight = new SimulatedActivitySource({ now: () => new Date(2026, 10, 18, 0, 0) });
    const atNoon = new SimulatedActivitySource({ now: () => NOON });
    const tomorrow = new SimulatedActivitySource({ now: () => new Date(2026, 10, 19, 8) });
    const range = { start: '2026-11-18', end: '2026-11-18' };

    const [midnight] = await atMidnight.getDailySummaries(range);
    const [noon] = await atNoon.getDailySummaries(range);
    const [complete] = await tomorrow.getDailySummaries(range);

    expect(midnight.steps).toBe(0);
    expect(noon.isComplete).toBe(false);
    expect(noon.steps).toBe(Math.round(complete.steps * 0.5));
    expect(complete.isComplete).toBe(true);
  });

  it('never returns future days', async () => {
    const source = new SimulatedActivitySource({ now: () => NOON });
    const days = await source.getDailySummaries({ start: '2026-11-17', end: '2026-11-20' });
    expect(days.map((d) => d.date)).toEqual(['2026-11-17', '2026-11-18']);
  });
});
