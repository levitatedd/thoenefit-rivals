import type { CategoryId, GoalMode } from '../types';
import type { ProfileId } from './profiles';
import { monteCarlo, simulateCompetition, standingOf, type PlayerSpec } from './simulate';

/**
 * The scenario catalogue used by both the tests and the report, so both describe exactly the
 * same experiments. All data is synthetic and seeded; results are fully reproducible.
 */

/** Runs per scenario for the published report; tests use fewer runs with wider tolerances. */
export const REPORT_RUNS = 400;
export const DURATIONS = [1, 3, 7] as const;

const honest = (id: string, profile: ProfileId, extra: Partial<PlayerSpec> = {}): PlayerSpec => ({
  id,
  profile,
  goalFactor: 1,
  ...extra,
});

/** Four fitness levels, everyone with an honest goal (their typical day). */
export function mixedFitness(
  days: number,
  categoryId: CategoryId = 'step-battle',
  runs = REPORT_RUNS,
) {
  return monteCarlo(runs, (run) => ({
    categoryId,
    days,
    seed: `mixed-${categoryId}-${days}-${run}`,
    players: [
      honest('light', 'light'),
      honest('moderate', 'moderate'),
      honest('active', 'active'),
      honest('athlete', 'athlete'),
    ],
  }));
}

/** Without personal goals: what raw totals would do (same synthetic players, goal = 1 step). */
export function rawTotalsBaseline(days: number, runs = REPORT_RUNS) {
  // Equal fixed goal for everyone ≈ ranking by raw activity (cap set far away by a tiny goal
  // would distort it, so use a common goal equal to the moderate profile's typical day).
  return monteCarlo(runs, (run) => ({
    categoryId: 'step-battle',
    days,
    seed: `mixed-step-battle-${days}-${run}`,
    players: (['light', 'moderate', 'active', 'athlete'] as ProfileId[]).map((p) => ({
      id: p,
      profile: p,
      // Everyone gets the moderate player's goal (8,500 steps).
      goalFactor: { light: 8500 / 5000, moderate: 1, active: 8500 / 12000, athlete: 8500 / 17000 }[
        p
      ],
    })),
  }));
}

/** One player sets a goal at `factor` × their typical day; three peers are honest. */
export function goalAmbition(
  factor: number,
  days: number,
  runs = REPORT_RUNS,
  goalMode: GoalMode = 'choose-own',
) {
  return monteCarlo(runs, (run) => ({
    categoryId: 'step-battle',
    days,
    goalMode,
    seed: `ambition-${factor}-${days}-${run}`,
    players: [
      { id: 'tested', profile: 'moderate', goalFactor: factor },
      honest('peer1', 'moderate'),
      honest('peer2', 'moderate'),
      honest('peer3', 'moderate'),
    ],
  }));
}

/** One player misses `missed` day(s) (confirmed zero); optionally has one exceptional day. */
export function missedDays(
  days: number,
  missed: number,
  exceptionalFactor?: number,
  runs = REPORT_RUNS,
) {
  return monteCarlo(runs, (run) => ({
    categoryId: 'step-battle',
    days,
    seed: `missed-${days}-${missed}-${exceptionalFactor ?? 0}-${run}`,
    players: [
      honest('tested', 'moderate', {
        missedDays: Array.from({ length: missed }, (_, i) => i),
        exceptionalDays: exceptionalFactor
          ? [{ day: days - 1, factor: exceptionalFactor }]
          : undefined,
      }),
      honest('peer1', 'moderate'),
      honest('peer2', 'moderate'),
      honest('peer3', 'moderate'),
    ],
  }));
}

/** Everyone sets the same goal factor; reports how often first place is shared. */
export function tieRate(days: number, goalFactor: number, runs = REPORT_RUNS) {
  return monteCarlo(runs, (run) => ({
    categoryId: 'step-battle',
    days,
    seed: `ties-${days}-${goalFactor}-${run}`,
    players: ['a', 'b', 'c', 'd'].map((id) => ({ id, profile: 'moderate' as const, goalFactor })),
  }));
}

/** Deterministic worked example of the daily cap and comeback over 7 days (goal 10,000). */
export function capAndComebackExample() {
  const sim = simulateCompetition({
    categoryId: 'step-battle',
    days: 7,
    seed: 'worked-example',
    players: [
      // Steady: exactly 12,000 every day.
      {
        id: 'steady',
        profile: 'moderate',
        goalFactor: 10000 / 8500,
        fixedActivity: Array(7).fill(12000),
      },
      // Comeback: misses the first two days, then has big days (25,000 is capped at 200 pts).
      {
        id: 'comeback',
        profile: 'moderate',
        goalFactor: 10000 / 8500,
        fixedActivity: [0, 0, 25000, 25000, 20000, 15000, 12000],
      },
      // Spike: one 60,000-step day, otherwise 6,000. The cap stops one outlier from deciding everything.
      {
        id: 'spike',
        profile: 'moderate',
        goalFactor: 10000 / 8500,
        fixedActivity: [6000, 6000, 60000, 6000, 6000, 6000, 6000],
      },
    ],
  });
  return {
    sim,
    steady: standingOf(sim, 'steady'),
    comeback: standingOf(sim, 'comeback'),
    spike: standingOf(sim, 'spike'),
  };
}
