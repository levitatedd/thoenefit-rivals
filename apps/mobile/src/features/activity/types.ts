/**
 * Normalized activity types shared by every health-data adapter.
 *
 * Adapters (simulated, Apple HealthKit, Android Health Connect, ...) all
 * produce `DailyActivitySummary` records. Scoring and leaderboard logic must
 * only depend on these types, never on a specific adapter.
 */

/** Local calendar date in `YYYY-MM-DD` form. */
export type DateKey = string;

export type ActivitySourceKind = 'simulated' | 'healthkit' | 'health-connect';

export interface ActivitySourceInfo {
  /** Stable identifier, e.g. `simulated`. */
  id: string;
  kind: ActivitySourceKind;
  /** Human-readable label shown in the UI. */
  label: string;
}

export interface DailyActivitySummary {
  date: DateKey;
  steps: number;
  /** Active energy burned, in kilocalories. */
  activeEnergyKcal: number;
  sourceId: string;
  /** False while the day is still in progress (e.g. today). */
  isComplete: boolean;
}

export interface DateRange {
  /** Inclusive start date. */
  start: DateKey;
  /** Inclusive end date. */
  end: DateKey;
}

export interface ActivityDataSource {
  readonly info: ActivitySourceInfo;
  /** Returns one summary per day in the range, ordered oldest first. */
  getDailySummaries(range: DateRange): Promise<DailyActivitySummary[]>;
}
