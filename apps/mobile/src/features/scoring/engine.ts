import { evaluateEligibility } from './eligibility';
import { assessGoal, suggestFutureGoal } from './fairness';
import { checkGoalForMode, publicGoalLabel, usualDayGoal } from './goals';
import { assertValidGoal, centiToPoints, dailyCentiPoints, isCapped, lockGoal } from './points';
import { CATEGORIES, RULES_V1 } from './rules';
import { addDays, datesBetween, parseInstant, startOfDay, toInstant } from './time';
import type {
  ActivityRecord,
  CategoryId,
  Competition,
  CompetitionResult,
  DailyScore,
  DateKey,
  DayStatus,
  EligibilityDecision,
  GoalMode,
  HistoryDay,
  Instant,
  Participant,
  Phase,
  PublicStanding,
  ScoringRules,
  Standing,
  SyncState,
} from './types';

// ---------------------------------------------------------------------------------------------
// Competition setup
// ---------------------------------------------------------------------------------------------

export interface NewParticipant {
  id: string;
  displayName: string;
  joinedAt: Instant;
  /** The participant's current profile goal for the competition's metric. */
  profileGoal: number;
  /** Recent daily history for private fairness guidance (optional). */
  history?: HistoryDay[];
  permission?: SyncState['permission'];
}

export interface NewCompetition {
  id: string;
  categoryId: CategoryId;
  timeZone: string;
  startDate: DateKey;
  endDate: DateKey;
  participants: NewParticipant[];
  rules?: ScoringRules;
  /**
   * Goal mode (#32). Defaults to `choose-own`, the v1 behaviour; the competition-creation flow
   * (#8) offers `usual-day` as its default.
   */
  goalMode?: GoalMode;
}

/** Competition window in epoch ms: [start of first day, start of the day after the last day), plus the finalization deadline. Throws on invalid dates or time zone. */
export function competitionWindow(
  competition: Pick<Competition, 'startDate' | 'endDate' | 'timeZone' | 'rules'>,
) {
  const dates = datesBetween(competition.startDate, competition.endDate);
  const windowStart = startOfDay(competition.startDate, competition.timeZone);
  const windowEnd = startOfDay(addDays(competition.endDate, 1), competition.timeZone);
  const finalizesAt = windowEnd + competition.rules.syncGraceHours * 3600 * 1000;
  return { dates, windowStart, windowEnd, finalizesAt };
}

/**
 * Creates a competition at its start: locks each participant's goal (a copy of the profile
 * goal) and snapshots their private fairness advisory. Participants must join before the start.
 * In usual-day mode, a goal below a participant's reliable usual day is rejected (#32).
 */
export function startCompetition(input: NewCompetition): Competition {
  const category = CATEGORIES[input.categoryId];
  if (!category) throw new Error(`Unknown competition category ${input.categoryId}`);
  const rules = input.rules ?? RULES_V1;
  const goalMode: GoalMode = input.goalMode ?? 'choose-own';
  const { windowStart } = competitionWindow({ ...input, rules });
  const lockedAt = toInstant(windowStart);
  const participants: Participant[] = input.participants.map((p) => {
    if (parseInstant(p.joinedAt) > windowStart) {
      throw new Error(
        `${p.displayName} joined after the competition started; late entry is not supported in v1`,
      );
    }
    const goal = lockGoal(category.metric, p.profileGoal, lockedAt);
    const usual = usualDayGoal(p.history ?? [], category.metric, rules, p.permission ?? 'granted');
    const check = checkGoalForMode(goalMode, goal.dailyGoal, usual);
    if (!check.ok) throw new Error(`${p.displayName}: ${check.error}`);
    return {
      id: p.id,
      displayName: p.displayName,
      joinedAt: p.joinedAt,
      goal,
      goalBasis: check.basis,
      usualDayGoal: usual.goal,
      fairnessAtStart: assessGoal(
        goal.dailyGoal,
        p.history ?? [],
        rules.fairness,
        p.permission ?? 'granted',
      ),
    };
  });
  const ids = new Set(participants.map((p) => p.id));
  if (ids.size !== participants.length) throw new Error('Participant ids must be unique');
  return Object.freeze({
    id: input.id,
    category,
    timeZone: input.timeZone,
    startDate: input.startDate,
    endDate: input.endDate,
    rules,
    goalMode,
    participants,
  });
}

// ---------------------------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------------------------

function phaseAt(asOf: number, windowStart: number, windowEnd: number, finalizesAt: number): Phase {
  if (asOf < windowStart) return 'not-started';
  if (asOf < windowEnd) return 'in-progress';
  if (asOf < finalizesAt) return 'grace';
  return 'final';
}

function dayStatus(args: {
  dayStart: number;
  dayEnd: number;
  asOf: number;
  phase: Phase;
  participant: Participant;
  sync: SyncState | undefined;
  hasActivity: boolean;
}): DayStatus {
  const { dayStart, dayEnd, asOf, phase, participant, sync, hasActivity } = args;
  if (participant.withdrawnAt && dayStart >= parseInstant(participant.withdrawnAt))
    return 'withdrawn';
  if (dayStart > asOf) return 'future';
  const syncedThrough = sync?.syncedThrough ? parseInstant(sync.syncedThrough) : -Infinity;
  if (syncedThrough >= dayEnd) return 'confirmed';
  const permitted = (sync?.permission ?? 'granted') === 'granted';
  if (phase === 'final') {
    // Finalized with whatever eligible activity arrived in time; no data is explained, not assumed.
    if (hasActivity) return 'confirmed';
    return permitted ? 'no-data' : 'permission-revoked';
  }
  return permitted ? 'pending' : 'permission-revoked';
}

/**
 * Scores a competition as of a moment in time.
 *
 * - Only records received at or before `asOf` are known; records received after the
 *   finalization deadline (end + grace) never count, so a final result is stable when
 *   recomputed later.
 * - Daily points are capped per day and summed; ranking uses exact centi-point totals and
 *   exact ties share a rank. Withdrawn participants keep their history but are not ranked.
 */
export function scoreCompetition(
  competition: Competition,
  records: ActivityRecord[],
  syncStates: SyncState[],
  asOfInstant: Instant,
): CompetitionResult {
  const asOf = parseInstant(asOfInstant);
  const { rules } = competition;
  const { dates, windowStart, windowEnd, finalizesAt } = competitionWindow(competition);
  for (const p of competition.participants) {
    assertValidGoal(p.goal.dailyGoal);
    if (p.goal.metric !== competition.category.metric) {
      throw new Error(
        `${p.displayName}'s goal is for ${p.goal.metric}, not ${competition.category.metric}`,
      );
    }
  }
  const phase = phaseAt(asOf, windowStart, windowEnd, finalizesAt);

  const known = records.filter((r) => {
    const received = Date.parse(r.receivedAt);
    return !Number.isFinite(received) || received <= asOf;
  });
  const decisions = evaluateEligibility(known, {
    competition,
    windowStart,
    windowEnd,
    finalizesAt,
  });
  const recordsById = new Map(known.map((r) => [r.id, r]));
  const syncById = new Map(syncStates.map((s) => [s.participantId, s]));

  const standings: Standing[] = competition.participants.map((participant) => {
    const mine = decisions.filter((d) => d.participantId === participant.id);
    const days: DailyScore[] = dates.map((date) => {
      const dayStart = startOfDay(date, competition.timeZone);
      const dayEnd = startOfDay(addDays(date, 1), competition.timeZone);
      const today = mine.filter((d) => d.day === date);
      const eligibleActivity = today
        .filter((d) => d.status === 'eligible')
        .reduce((sum, d) => sum + (recordsById.get(d.recordId)?.value ?? 0), 0);
      const status = dayStatus({
        dayStart,
        dayEnd,
        asOf,
        phase,
        participant,
        sync: syncById.get(participant.id),
        hasActivity: eligibleActivity > 0,
      });
      const scores = status !== 'future' && status !== 'withdrawn';
      const centiPoints = scores
        ? dailyCentiPoints(eligibleActivity, participant.goal.dailyGoal, rules)
        : 0;
      return {
        date,
        status,
        eligibleActivity: scores ? eligibleActivity : 0,
        centiPoints,
        points: centiToPoints(centiPoints),
        capped: isCapped(centiPoints, rules),
        heldRecordIds: today.filter((d) => d.status === 'held').map((d) => d.recordId),
      };
    });
    const totalCentiPoints = days.reduce((sum, d) => sum + d.centiPoints, 0);
    const withdrawn = Boolean(participant.withdrawnAt);
    return {
      participantId: participant.id,
      displayName: participant.displayName,
      goal: participant.goal,
      days,
      totalCentiPoints,
      totalPoints: centiToPoints(totalCentiPoints),
      rank: null,
      withdrawn,
      provisional: phase !== 'final',
      decisions: mine.filter((d) => d.status !== 'eligible'),
      goalSuggestion: suggestFutureGoal(
        days,
        dates.length,
        participant.goal.dailyGoal,
        competition.category.metric,
        rules,
      ),
      ...(participant.fairnessAtStart ? { fairnessAtStart: participant.fairnessAtStart } : {}),
      goalBasis: participant.goalBasis,
    };
  });

  rankStandings(standings);

  return {
    competitionId: competition.id,
    categoryId: competition.category.id,
    metric: competition.category.metric,
    rules,
    goalMode: competition.goalMode,
    timeZone: competition.timeZone,
    phase,
    computedAt: toInstant(asOf),
    finalizesAt: toInstant(finalizesAt),
    standings,
  };
}

/** Competition ranking ("1, 1, 3"): exact centi-point ties share a rank. Sorts in place. */
export function rankStandings(standings: Standing[]): Standing[] {
  standings.sort(
    (a, b) =>
      Number(a.withdrawn) - Number(b.withdrawn) ||
      b.totalCentiPoints - a.totalCentiPoints ||
      a.displayName.localeCompare(b.displayName) ||
      a.participantId.localeCompare(b.participantId),
  );
  let rank = 0;
  let previous: number | undefined;
  standings.forEach((s, index) => {
    if (s.withdrawn) {
      s.rank = null;
      return;
    }
    if (s.totalCentiPoints !== previous) rank = index + 1;
    previous = s.totalCentiPoints;
    s.rank = rank;
  });
  return standings;
}

/** Leaderboard view for other participants: goals and scores only, no raw records or advice. */
export function toPublicStandings(result: CompetitionResult): PublicStanding[] {
  return result.standings.map((s) => ({
    participantId: s.participantId,
    displayName: s.displayName,
    dailyGoal: s.goal.dailyGoal,
    metric: s.goal.metric,
    goalLabel: publicGoalLabel(result.goalMode, s.goalBasis, s.fairnessAtStart),
    days: s.days.map(({ date, status, points, capped }) => ({ date, status, points, capped })),
    totalPoints: s.totalPoints,
    rank: s.rank,
    withdrawn: s.withdrawn,
    provisional: s.provisional,
  }));
}

/** Records that are held or excluded for one participant, with explanations (private). */
export function explainDecisions(
  result: CompetitionResult,
  participantId: string,
): EligibilityDecision[] {
  return result.standings.find((s) => s.participantId === participantId)?.decisions ?? [];
}
