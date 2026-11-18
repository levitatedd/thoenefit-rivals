import { RULES_V1, type CategoryId, type GoalMode } from '@/features/scoring';

import { DEMO_PLAYERS, defaultGoal, type DemoPlayerId } from './players';

/**
 * Demo Scoring Settings (#3): prototype-only controls for simulated demo competitions.
 * They never change `RULES_V1` or any real competition; the defaults equal the production rules.
 */
export interface DemoScoringSettings {
  dailyCapPoints: number;
  pointsPerGoal: number;
  /** Daily goal per category and simulated participant. */
  goals: Record<CategoryId, Record<DemoPlayerId, number>>;
}

export interface DemoState {
  settings: DemoScoringSettings;
  /** First day of the demo Step Battle ("today" when the demo was created or reset). */
  anchorDate: string;
  /** How far the demo clock is ahead of the real clock. */
  clockOffsetMs: number;
  /** Extra activity added to "You" by the demo controls, per category and date. */
  added: Record<CategoryId, Record<string, number>>;
  /** Changes every simulated value when shuffled. */
  seed: number;
  /**
   * Goal mode per demo competition (#32). A real competition option chosen by the organizer
   * (#8), not a scoring-rule change, so it doesn't trigger the "demo scoring settings" notice.
   */
  goalModes: Record<CategoryId, GoalMode>;
}

export const DEFAULT_GOAL_MODES: Readonly<Record<CategoryId, GoalMode>> = Object.freeze({
  'step-battle': 'usual-day',
  'calorie-clash': 'choose-own',
});

export const SETTING_LIMITS = {
  dailyCapPoints: { min: 50, max: 500, step: 25 },
  pointsPerGoal: { min: 10, max: 300, step: 10 },
  goals: {
    'step-battle': { min: 1000, max: 40000, step: 500 },
    'calorie-clash': { min: 50, max: 2000, step: 10 },
  },
} as const;

export function defaultSettings(): DemoScoringSettings {
  const goalsFor = (categoryId: CategoryId) =>
    Object.fromEntries(DEMO_PLAYERS.map((p) => [p.id, defaultGoal(p, categoryId)])) as Record<
      DemoPlayerId,
      number
    >;
  return {
    dailyCapPoints: RULES_V1.dailyCapPoints,
    pointsPerGoal: RULES_V1.pointsPerGoal,
    goals: { 'step-battle': goalsFor('step-battle'), 'calorie-clash': goalsFor('calorie-clash') },
  };
}

export function initialDemoState(anchorDate: string): DemoState {
  return {
    settings: defaultSettings(),
    anchorDate,
    clockOffsetMs: 0,
    added: { 'step-battle': {}, 'calorie-clash': {} },
    seed: 1,
    goalModes: { ...DEFAULT_GOAL_MODES },
  };
}

/** True when any setting differs from the production defaults. */
export function settingsChanged(settings: DemoScoringSettings): boolean {
  const defaults = defaultSettings();
  if (settings.dailyCapPoints !== defaults.dailyCapPoints) return true;
  if (settings.pointsPerGoal !== defaults.pointsPerGoal) return true;
  return (Object.keys(defaults.goals) as CategoryId[]).some((c) =>
    DEMO_PLAYERS.some((p) => settings.goals[c][p.id] !== defaults.goals[c][p.id]),
  );
}

export type DemoAction =
  | { type: 'add-activity'; categoryId: CategoryId; date: string; amount: number }
  | { type: 'advance-clock'; toMs: number; nowMs: number }
  | { type: 'set-cap'; value: number }
  | { type: 'set-points-per-goal'; value: number }
  | { type: 'set-goal'; categoryId: CategoryId; playerId: DemoPlayerId; value: number }
  | { type: 'set-goal-mode'; categoryId: CategoryId; mode: GoalMode }
  | { type: 'shuffle' }
  | { type: 'reset'; anchorDate: string };

function clamp(value: number, limits: { min: number; max: number }): number {
  if (!Number.isFinite(value)) return limits.min;
  return Math.min(limits.max, Math.max(limits.min, Math.round(value)));
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'add-activity': {
      const byDate = state.added[action.categoryId];
      const current = byDate[action.date] ?? 0;
      return {
        ...state,
        added: {
          ...state.added,
          [action.categoryId]: {
            ...byDate,
            [action.date]: Math.max(0, current + action.amount),
          },
        },
      };
    }
    case 'advance-clock': {
      // The demo clock only moves forward.
      const target = action.toMs - action.nowMs;
      return target > state.clockOffsetMs ? { ...state, clockOffsetMs: target } : state;
    }
    case 'set-cap':
      return {
        ...state,
        settings: {
          ...state.settings,
          dailyCapPoints: clamp(action.value, SETTING_LIMITS.dailyCapPoints),
        },
      };
    case 'set-points-per-goal':
      return {
        ...state,
        settings: {
          ...state.settings,
          pointsPerGoal: clamp(action.value, SETTING_LIMITS.pointsPerGoal),
        },
      };
    case 'set-goal': {
      const goals = state.settings.goals[action.categoryId];
      return {
        ...state,
        settings: {
          ...state.settings,
          goals: {
            ...state.settings.goals,
            [action.categoryId]: {
              ...goals,
              [action.playerId]: clamp(action.value, SETTING_LIMITS.goals[action.categoryId]),
            },
          },
        },
      };
    }
    case 'set-goal-mode':
      return { ...state, goalModes: { ...state.goalModes, [action.categoryId]: action.mode } };
    case 'shuffle':
      return { ...state, seed: state.seed + 1 };
    case 'reset':
      return initialDemoState(action.anchorDate);
  }
}
