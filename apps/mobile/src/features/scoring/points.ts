import type { GoalSnapshot, Instant, MetricId, ScoringRules } from './types';

/**
 * Daily points = min(cap, pointsPerGoal × activity / goal), computed in hundredths of a point.
 *
 * Precision: each day's points are rounded half-up to 0.01 (integer "centi-points"). Totals are
 * exact sums of those integers, and ranking compares totals in centi-points, so ranking never
 * depends on floating-point drift. Display rounds totals to whole points; two players can show
 * the same whole number but differ by hundredths (the leaderboard explains that ties are exact).
 */
export function dailyCentiPoints(activity: number, goal: number, rules: ScoringRules): number {
  assertValidGoal(goal);
  const safeActivity = Number.isFinite(activity) && activity > 0 ? activity : 0;
  const capCenti = rules.dailyCapPoints * 100;
  const raw = (safeActivity * rules.pointsPerGoal * 100) / goal;
  // Round half-up; nudge by a tiny epsilon so values like 12.345 (stored as 12.34499…) round as written.
  const rounded = Math.floor(raw + 0.5 + 1e-9);
  return Math.min(capCenti, rounded);
}

export function isCapped(centiPoints: number, rules: ScoringRules): boolean {
  return centiPoints >= rules.dailyCapPoints * 100;
}

/** Display value for points (2 decimals of precision preserved). */
export function centiToPoints(centi: number): number {
  return centi / 100;
}

/** Goals must be finite and strictly positive. Easy goals are allowed (see fairness guidance). */
export function assertValidGoal(goal: number): void {
  if (typeof goal !== 'number' || !Number.isFinite(goal) || goal <= 0) {
    throw new Error(
      `Invalid daily goal ${String(goal)}: goals must be finite numbers greater than 0`,
    );
  }
}

/**
 * Optional configurable floor for goals (e.g. at least 1 step). It only rejects nonsense; it
 * must not be used to block goals for being easy.
 */
export function validateGoal(
  goal: number,
  minimum = 0,
): { ok: true } | { ok: false; error: string } {
  try {
    assertValidGoal(goal);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  if (goal < minimum) return { ok: false, error: `Daily goal must be at least ${minimum}` };
  return { ok: true };
}

/**
 * Locks a participant's goal when a competition starts. The returned snapshot is a copy:
 * later changes to the participant's profile goal never affect it.
 */
export function lockGoal(metric: MetricId, profileGoal: number, lockedAt: Instant): GoalSnapshot {
  assertValidGoal(profileGoal);
  return Object.freeze({ metric, dailyGoal: profileGoal, lockedAt });
}
