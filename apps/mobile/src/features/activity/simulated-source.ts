import { fractionOfDayElapsed, listDateKeys, toDateKey } from './dates';
import type {
  ActivityDataSource,
  ActivitySourceInfo,
  DailyActivitySummary,
  DateRange,
} from './types';

/**
 * Generates plausible, deterministic activity data for development.
 *
 * The same seed and date always produce the same full-day totals, so the UI
 * and tests are stable. Today's totals are scaled by how much of the day has
 * elapsed so the dashboard looks like a live day in progress.
 *
 * This is NOT real health data and must never be presented as such.
 */

export const SIMULATED_SOURCE_INFO: ActivitySourceInfo = {
  id: 'simulated',
  kind: 'simulated',
  label: 'Simulated data',
};

export interface SimulatedSourceOptions {
  /** Changes the generated values; use different seeds for different simulated people. */
  seed?: string;
  /** Injectable clock for tests. */
  now?: () => Date;
  /** Typical full-day step count. */
  baselineSteps?: number;
  /** Typical full-day active energy in kcal. */
  baselineActiveEnergyKcal?: number;
}

/** FNV-1a string hash → 32-bit unsigned integer. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mulberry32 PRNG: small, fast, deterministic. Returns values in [0, 1). */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SimulatedActivitySource implements ActivityDataSource {
  readonly info = SIMULATED_SOURCE_INFO;

  private readonly seed: string;
  private readonly now: () => Date;
  private readonly baselineSteps: number;
  private readonly baselineActiveEnergyKcal: number;

  constructor(options: SimulatedSourceOptions = {}) {
    this.seed = options.seed ?? 'demo-user';
    this.now = options.now ?? (() => new Date());
    this.baselineSteps = options.baselineSteps ?? 8500;
    this.baselineActiveEnergyKcal = options.baselineActiveEnergyKcal ?? 480;
  }

  async getDailySummaries(range: DateRange): Promise<DailyActivitySummary[]> {
    const now = this.now();
    const todayKey = toDateKey(now);

    return listDateKeys(range)
      .filter((date) => date <= todayKey)
      .map((date) => {
        const full = this.fullDayTotals(date);
        const isToday = date === todayKey;
        const progress = isToday ? fractionOfDayElapsed(now) : 1;
        return {
          date,
          steps: Math.round(full.steps * progress),
          activeEnergyKcal: Math.round(full.activeEnergyKcal * progress),
          sourceId: this.info.id,
          isComplete: !isToday,
        };
      });
  }

  private fullDayTotals(date: string) {
    const random = createRandom(hashString(`${this.seed}:${date}`));
    // Day-level intensity between 0.45x and 1.65x of baseline, with a
    // correlated component so high-step days tend to burn more energy.
    const intensity = 0.45 + random() * 1.2;
    const stepsJitter = 0.9 + random() * 0.2;
    const energyJitter = 0.85 + random() * 0.3;
    return {
      steps: Math.round(this.baselineSteps * intensity * stepsJitter),
      activeEnergyKcal: Math.round(this.baselineActiveEnergyKcal * intensity * energyJitter),
    };
  }
}
