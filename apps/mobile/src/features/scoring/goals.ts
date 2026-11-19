import { computeBaseline } from './fairness';
import type {
  FairnessAssessment,
  GoalBasis,
  GoalMode,
  HistoryDay,
  MetricId,
  PublicGoalLabel,
  ScoringRules,
  SyncState,
} from './types';

/**
 * Goal modes (#32, owner decision D4). Points are never affected: the formula (#2) is the same
 * in both modes. Only how the goal may be set, and the neutral label others see, differ.
 */

export interface UsualDay {
  /** Rounded usual day, or null when there is no reliable history. */
  goal: number | null;
  /** True when the history has enough valid days and permission is granted. */
  reliable: boolean;
  validDays: number;
}

/**
 * A participant's usual day for a usual-day competition: the 28-day median (missing days are not
 * zero), rounded to 100 steps / 10 kcal. Only "reliable" history (14+ valid days, permission
 * granted, non-zero median) produces a usual-day goal; everyone else chooses their own goal.
 */
export function usualDayGoal(
  history: HistoryDay[],
  metric: MetricId,
  rules: ScoringRules,
  permission: SyncState['permission'] = 'granted',
): UsualDay {
  const { baseline, validDays } = computeBaseline(history, rules.fairness);
  const step = rules.goalModes.roundTo[metric];
  const reliable =
    permission === 'granted' &&
    validDays >= rules.goalModes.usualDayMinValidDays &&
    baseline !== null &&
    baseline > 0;
  if (!reliable || baseline === null) return { goal: null, reliable: false, validDays };
  return { goal: Math.max(step, Math.round(baseline / step) * step), reliable: true, validDays };
}

/**
 * Validates a requested goal under a goal mode. In usual-day mode, with reliable history, the
 * goal can be raised above the usual day but not lowered below it. Limited history: any goal.
 */
export function checkGoalForMode(
  mode: GoalMode,
  requestedGoal: number,
  usual: UsualDay,
): { ok: true; basis: GoalBasis } | { ok: false; minimum: number; error: string } {
  if (!usual.reliable || usual.goal === null) return { ok: true, basis: 'limited-history' };
  if (mode === 'choose-own') return { ok: true, basis: 'own-choice' };
  if (requestedGoal < usual.goal) {
    return {
      ok: false,
      minimum: usual.goal,
      error: `In a usual-day competition your goal can be raised but not set below your usual day (${usual.goal}).`,
    };
  }
  return { ok: true, basis: requestedGoal === usual.goal ? 'usual-day' : 'raised' };
}

/**
 * The neutral label other participants see. Never numbers or history, and never "below usual"
 * for someone with limited history (they are labelled "limited history" instead). Casual mode
 * uses the private fairness band at start, collapsed to neutral wording ("potentially easy" is
 * shown as "below usual").
 */
export function publicGoalLabel(
  mode: GoalMode,
  basis: GoalBasis,
  fairness: FairnessAssessment | undefined,
): PublicGoalLabel {
  if (basis === 'limited-history') return 'limited-history';
  if (mode === 'usual-day') return basis === 'raised' ? 'above-usual' : 'usual-day';
  switch (fairness?.band) {
    case 'near-usual':
      return 'near-usual';
    case 'below-usual':
    case 'potentially-easy':
      return 'below-usual';
    case 'above-usual':
      return 'above-usual';
    default:
      return 'limited-history';
  }
}
