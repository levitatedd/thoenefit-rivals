/**
 * ThoeneFit Rivals scoring engine (issue #2). Pure TypeScript with no React Native imports, so
 * it can move to a shared package or a server later without changes.
 */
export * from './types';
export { CATEGORIES, RULES_V1 } from './rules';
export {
  dailyCentiPoints,
  centiToPoints,
  isCapped,
  validateGoal,
  assertValidGoal,
  lockGoal,
} from './points';
export { evaluateEligibility, EXPLANATIONS } from './eligibility';
export { computeBaseline, assessGoal, capSuggestionThreshold, suggestFutureGoal } from './fairness';
export { usualDayGoal, checkGoalForMode, publicGoalLabel } from './goals';
export type { UsualDay } from './goals';
export {
  startCompetition,
  scoreCompetition,
  competitionWindow,
  rankStandings,
  toPublicStandings,
  explainDecisions,
} from './engine';
export type { NewCompetition, NewParticipant } from './engine';
export { dayOf, startOfDay, addDays, datesBetween } from './time';
