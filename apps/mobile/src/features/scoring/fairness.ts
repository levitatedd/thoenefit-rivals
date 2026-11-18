import { assertValidGoal } from './points';
import type {
  DailyScore,
  FairnessAssessment,
  FairnessRules,
  GoalSuggestion,
  HistoryDay,
  HistorySufficiency,
  MetricId,
  ScoringRules,
  SyncState,
} from './types';

/**
 * Private, advisory goal guidance. It never changes points, never blocks joining, never
 * auto-adjusts goals, and is shown only to the goal owner. Detailed history stays private.
 */

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Baseline = median of the most recent `baselineDays` calendar days. Genuine zero days count;
 * days with no synced data (`null`) are missing, not zero.
 */
export function computeBaseline(
  history: HistoryDay[],
  rules: FairnessRules,
): { baseline: number | null; validDays: number; sufficiency: HistorySufficiency } {
  const recent = [...history]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, rules.baselineDays);
  const valid = recent
    .map((d) => d.value)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0);
  const validDays = valid.length;
  const sufficiency: HistorySufficiency =
    validDays >= rules.normalMinValidDays
      ? 'normal'
      : validDays >= rules.provisionalMinValidDays
        ? 'provisional'
        : 'insufficient';
  return { baseline: validDays > 0 ? median(valid) : null, validDays, sufficiency };
}

const MESSAGES: Record<FairnessAssessment['band'], string> = {
  'potentially-easy':
    'Your goal is well below your usual day, so points will come much more easily for you than for players whose goals match their usual day. You can keep it; other players can see your goal.',
  'below-usual':
    'Your goal is a bit below your usual day, so points will come a little more easily for you than for players whose goals match their usual day.',
  'near-usual': 'Your goal is close to your usual day.',
  'above-usual':
    'Your goal is above your usual day. A higher goal makes each point harder to earn, so it’s a real challenge in a competition.',
  'zero-baseline':
    'Your recent history shows no activity for this metric, so we can’t compare your goal.',
  'insufficient-history': 'There isn’t enough recent history yet to compare your goal.',
  unavailable:
    'Activity history isn’t available (permission not granted), so we can’t compare your goal.',
};

/**
 * Classifies a goal against the participant's recent history. Snapshot this at competition
 * start; never recompute it from performance during the competition.
 */
export function assessGoal(
  goal: number,
  history: HistoryDay[],
  rules: FairnessRules,
  permission: SyncState['permission'] = 'granted',
): FairnessAssessment {
  assertValidGoal(goal);
  const { baseline, validDays, sufficiency } = computeBaseline(history, rules);
  const make = (band: FairnessAssessment['band'], ratio: number | null): FairnessAssessment => {
    const provisionalNote =
      sufficiency === 'provisional' && ratio !== null
        ? ' (based on limited history, so treat this as a rough guide)'
        : '';
    return {
      band,
      sufficiency,
      validDays,
      baseline,
      ratio,
      message: MESSAGES[band] + provisionalNote,
    };
  };
  if (permission !== 'granted') return make('unavailable', null);
  if (sufficiency === 'insufficient' || baseline === null)
    return make('insufficient-history', null);
  if (baseline === 0) return make('zero-baseline', null);
  const ratio = goal / baseline;
  if (ratio < rules.potentiallyEasyBelow) return make('potentially-easy', ratio);
  if (ratio < rules.belowUsualBelow) return make('below-usual', ratio);
  if (ratio > rules.aboveUsualAbove) return make('above-usual', ratio);
  return make('near-usual', ratio);
}

/** Capped days needed before suggesting a higher future goal, for a competition length. */
export function capSuggestionThreshold(competitionDays: number, rules: ScoringRules): number {
  const { capDayRatio, minCapDays } = rules.capSuggestion;
  return Math.max(minCapDays, Math.ceil(competitionDays * capDayRatio - 1e-9));
}

function roundGoal(value: number, metric: MetricId): number {
  const step = metric === 'steps' ? 100 : 10;
  return Math.ceil(value / step) * step;
}

/**
 * At most one private suggestion per competition, for future competitions only. It never
 * changes the current goal or any score.
 */
export function suggestFutureGoal(
  days: DailyScore[],
  competitionDays: number,
  goal: number,
  metric: MetricId,
  rules: ScoringRules,
): GoalSuggestion | undefined {
  const cappedDays = days.filter((d) => d.capped).length;
  const threshold = capSuggestionThreshold(competitionDays, rules);
  if (cappedDays < threshold) return undefined;
  const suggestedGoal = roundGoal(goal * (1 + rules.capSuggestion.increaseFraction), metric);
  return {
    cappedDays,
    threshold,
    currentGoal: goal,
    suggestedGoal,
    appliesTo: 'future-competitions',
    message: `You hit the daily maximum on ${cappedDays} days. For your next competition, consider a goal of about ${suggestedGoal}. This doesn’t change this competition.`,
  };
}
