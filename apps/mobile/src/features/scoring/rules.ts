import type { CategoryId, CompetitionCategory, ScoringRules } from './types';

/** Launch categories: one primary metric each. Steps and calories are never added together. */
export const CATEGORIES: Readonly<Record<CategoryId, CompetitionCategory>> = Object.freeze({
  'step-battle': { id: 'step-battle', name: 'Step Battle', metric: 'steps', unit: 'steps' },
  'calorie-clash': {
    id: 'calorie-clash',
    name: 'Calorie Clash',
    metric: 'activeEnergyKcal',
    unit: 'kcal (active)',
  },
});

/**
 * Scoring rules v1, as agreed in issue #2. The thresholds marked "proposed" are configurable
 * starting points for playtesting (#14), not final product decisions.
 */
export const RULES_V1: Readonly<ScoringRules> = Object.freeze({
  version: 'v1',
  pointsPerGoal: 100,
  dailyCapPoints: 200,
  syncGraceHours: 24, // proposed
  // Overlapping samples from different sources: prefer the watch, then the phone.
  sourcePriority: ['unknown', 'third-party-import', 'phone', 'watch'],
  fairness: Object.freeze({
    baselineDays: 28, // proposed
    normalMinValidDays: 14, // proposed
    provisionalMinValidDays: 7, // proposed
    potentiallyEasyBelow: 0.6, // proposed
    // "Near usual" is 90–110% (narrowed from 80–120% after #14; owner decision D4/E, #31).
    // Advisory only: every competition stores its own copy of these rules, so earlier
    // competitions keep the bands they started with.
    belowUsualBelow: 0.9,
    aboveUsualAbove: 1.1,
  }),
  capSuggestion: Object.freeze({
    capDayRatio: 3 / 7, // proposed: 3 capped days in a 7-day competition
    minCapDays: 2,
    increaseFraction: 0.1, // proposed: +10%
  }),
}) as ScoringRules;
