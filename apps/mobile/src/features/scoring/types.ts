/**
 * Types for the ThoeneFit Rivals scoring engine (issue #2).
 *
 * The engine is pure TypeScript: no React Native, network, storage or health-platform imports.
 * Health adapters (HealthKit, Health Connect, simulated) produce `ActivityRecord`s; this module
 * decides eligibility, scores days, ranks participants, and gives private fairness guidance.
 */

/** Local calendar date `YYYY-MM-DD` in the competition time zone. */
export type DateKey = string;

/** ISO-8601 instant with offset, e.g. `2026-11-18T09:30:00Z`. */
export type Instant = string;

/** Metrics a competition can score. One primary metric per competition; never blended. */
export type MetricId = 'steps' | 'activeEnergyKcal';

export type CategoryId = 'step-battle' | 'calorie-clash';

export interface CompetitionCategory {
  id: CategoryId;
  name: string;
  metric: MetricId;
  unit: string;
}

// ---------------------------------------------------------------------------------------------
// Rules (versioned, snapshotted into every competition and result)
// ---------------------------------------------------------------------------------------------

export interface FairnessRules {
  /** Calendar days of history used for the goal baseline (median). */
  baselineDays: number;
  /** Valid days needed for a normal / provisional advisory; fewer is "insufficient". */
  normalMinValidDays: number;
  provisionalMinValidDays: number;
  /** Goal / baseline ratio band boundaries (advisory only; not clinical standards). */
  potentiallyEasyBelow: number;
  belowUsualBelow: number;
  aboveUsualAbove: number;
}

export interface CapSuggestionRules {
  /** Suggest a higher future goal when capped days ≥ ceil(competition days × this ratio)… */
  capDayRatio: number;
  /** …and at least this many capped days. With 3/7 and 2, a 7-day competition needs 3. */
  minCapDays: number;
  /** Suggested increase for future competitions, as a fraction (0.1 = +10%). */
  increaseFraction: number;
}

export interface ScoringRules {
  /** Stored with every result so historical scores are never reinterpreted by newer rules. */
  version: string;
  /** Points for exactly meeting the daily goal. */
  pointsPerGoal: number;
  /** Daily points cap (each day is capped individually). */
  dailyCapPoints: number;
  /** Post-end window in which late-arriving activity (that occurred in the window) still counts. */
  syncGraceHours: number;
  /** Higher index wins when overlapping samples from different sources must be resolved. */
  sourcePriority: SourceKind[];
  fairness: FairnessRules;
  capSuggestion: CapSuggestionRules;
}

// ---------------------------------------------------------------------------------------------
// Competition setup
// ---------------------------------------------------------------------------------------------

/** A participant's goal, locked when the competition starts; profile edits never change it. */
export interface GoalSnapshot {
  metric: MetricId;
  dailyGoal: number;
  lockedAt: Instant;
}

export interface Participant {
  id: string;
  displayName: string;
  /** Must be at or before the competition start; no late entry or retroactive points in v1. */
  joinedAt: Instant;
  goal: GoalSnapshot;
  /** Set when the participant withdraws; earlier days are kept, later days don't score. */
  withdrawnAt?: Instant;
  /** Private advisory computed at start; shown only to the participant. */
  fairnessAtStart?: FairnessAssessment;
}

export interface Competition {
  id: string;
  category: CompetitionCategory;
  /** IANA time zone that defines every competition day, e.g. `America/Chicago`. */
  timeZone: string;
  /** First and last competition days (inclusive), in `timeZone`. */
  startDate: DateKey;
  endDate: DateKey;
  rules: ScoringRules;
  participants: Participant[];
}

// ---------------------------------------------------------------------------------------------
// Activity input and provenance
// ---------------------------------------------------------------------------------------------

/**
 * Where a record came from. Provenance is metadata reported by the platform, **not** proof of
 * real activity; it is used to avoid accidental duplication and manual entries, not to detect
 * cheating.
 */
export type SourceKind = 'unknown' | 'third-party-import' | 'phone' | 'watch';

export interface SourceProvenance {
  kind: SourceKind;
  /** Health store: HealthKit, Health Connect, or the simulated adapter. */
  platform: 'healthkit' | 'health-connect' | 'simulated';
  /** Recording method as reported by the platform. */
  recordingMethod: 'automatic' | 'manual' | 'unknown';
  /** Stable device identifier, when the platform provides one. */
  deviceId?: string;
  /** Writing app / package id (e.g. a third-party fitness app), when known. */
  appId?: string;
}

/**
 * - `daily-total`: a platform-aggregated, already de-duplicated total for one day (preferred).
 * - `sample`: an individual interval measurement (e.g. steps between two times).
 * - `workout`: workout-level energy/steps; already contained in daily totals, never added.
 */
export type RecordType = 'daily-total' | 'sample' | 'workout';

export interface ActivityRecord {
  id: string;
  participantId: string;
  metric: MetricId;
  value: number;
  start: Instant;
  end: Instant;
  type: RecordType;
  source: SourceProvenance;
  /** When the app received/synced the record. Used for grace-period and finalization rules. */
  receivedAt: Instant;
}

/** How far a participant's data is known to be synced. Missing data is never assumed zero. */
export interface SyncState {
  participantId: string;
  /** Activity up to this instant is fully synced; days ending at or before it are confirmed. */
  syncedThrough?: Instant;
  /** The participant revoked or never granted the metric's health permission. */
  permission: 'granted' | 'revoked' | 'not-requested';
}

// ---------------------------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------------------------

export type ReasonCode =
  | 'MANUAL_ENTRY'
  | 'DUPLICATE_ACTIVITY'
  | 'UNKNOWN_SOURCE'
  | 'OVERLAP_UNRESOLVED'
  | 'OUTSIDE_COMPETITION'
  | 'UNSUPPORTED_METRIC'
  | 'INVALID_RECORD'
  | 'LATE_SYNC';

export type EligibilityStatus = 'eligible' | 'excluded' | 'held';

export interface EligibilityDecision {
  recordId: string;
  participantId: string;
  status: EligibilityStatus;
  /** Competition day the record belongs to (when it could be determined). */
  day?: DateKey;
  reason?: ReasonCode;
  /** User-friendly explanation for held/excluded records. */
  explanation?: string;
}

// ---------------------------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------------------------

/**
 * - `confirmed`: synced through the end of the day (a zero here is a real zero).
 * - `pending`: day still in progress or not yet fully synced; provisional.
 * - `no-data`: finalized without synced data; scores 0 with an explanation.
 * - `permission-revoked`: health permission missing; scores 0 with an explanation.
 * - `future`: day hasn't started yet.
 * - `withdrawn`: after the participant withdrew.
 */
export type DayStatus =
  'confirmed' | 'pending' | 'no-data' | 'permission-revoked' | 'future' | 'withdrawn';

export interface DailyScore {
  date: DateKey;
  status: DayStatus;
  /** Sum of eligible activity for the day, in the metric's unit. */
  eligibleActivity: number;
  /** Points in hundredths (integer, exact). Ranking uses this. */
  centiPoints: number;
  /** `centiPoints / 100`, for display. */
  points: number;
  capped: boolean;
  /** Records held for this day (they don't count until resolved). */
  heldRecordIds: string[];
}

export type Phase = 'not-started' | 'in-progress' | 'grace' | 'final';

export interface Standing {
  participantId: string;
  displayName: string;
  goal: GoalSnapshot;
  days: DailyScore[];
  totalCentiPoints: number;
  totalPoints: number;
  /** Competition ranking: exact ties share a rank (1, 1, 3). `null` when withdrawn. */
  rank: number | null;
  withdrawn: boolean;
  /** True while any day can still change (in progress / grace / pending sync). */
  provisional: boolean;
  /** Private: held and excluded records with explanations, for the participant only. */
  decisions: EligibilityDecision[];
  /** Private: future-goal suggestion after repeated capped days. Never changes current scores. */
  goalSuggestion?: GoalSuggestion;
  /** Private: fairness advisory snapshotted at start. */
  fairnessAtStart?: FairnessAssessment;
}

export interface CompetitionResult {
  competitionId: string;
  categoryId: CategoryId;
  metric: MetricId;
  rules: ScoringRules;
  timeZone: string;
  phase: Phase;
  computedAt: Instant;
  /** Records received after this instant are never counted (finalization deadline). */
  finalizesAt: Instant;
  standings: Standing[];
}

/** What other participants may see: goals and scores, never raw records or private advice. */
export interface PublicStanding {
  participantId: string;
  displayName: string;
  dailyGoal: number;
  metric: MetricId;
  days: Pick<DailyScore, 'date' | 'status' | 'points' | 'capped'>[];
  totalPoints: number;
  rank: number | null;
  withdrawn: boolean;
  provisional: boolean;
}

// ---------------------------------------------------------------------------------------------
// Fairness guidance (private, advisory only)
// ---------------------------------------------------------------------------------------------

export interface HistoryDay {
  date: DateKey;
  /** Synced daily total, `0` for a genuine zero day, `null` when no data / not synced. */
  value: number | null;
}

export type HistorySufficiency = 'normal' | 'provisional' | 'insufficient';

export type FairnessBand =
  | 'potentially-easy'
  | 'below-usual'
  | 'near-usual'
  | 'above-usual'
  | 'zero-baseline'
  | 'insufficient-history'
  | 'unavailable';

export interface FairnessAssessment {
  band: FairnessBand;
  sufficiency: HistorySufficiency;
  validDays: number;
  /** Median of valid days, or null when it can't be computed. */
  baseline: number | null;
  /** goal / baseline, or null. */
  ratio: number | null;
  /** Neutral, private message for the goal owner. */
  message: string;
}

export interface GoalSuggestion {
  cappedDays: number;
  threshold: number;
  currentGoal: number;
  suggestedGoal: number;
  /** Suggestions apply to future competitions only. */
  appliesTo: 'future-competitions';
  message: string;
}
