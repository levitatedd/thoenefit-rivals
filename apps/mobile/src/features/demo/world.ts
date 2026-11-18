import {
  CATEGORIES,
  RULES_V1,
  addDays,
  competitionWindow,
  dayOf,
  scoreCompetition,
  startCompetition,
  type ActivityRecord,
  type CategoryId,
  type Competition,
  type CompetitionResult,
  type ScoringRules,
  type Standing,
  startOfDay,
  type SyncState,
} from '@/features/scoring';
import { createRandom, dailyMultiplier } from '@/features/scoring/simulation/random';
import { PROFILES } from '@/features/scoring/simulation/profiles';

import {
  DEMO_PLAYERS,
  YOU,
  playerHistory,
  playerUsualDay,
  typicalDay,
  type DemoPlayer,
  type DemoPlayerId,
} from './players';
import { settingsChanged, type DemoState } from './state';

/**
 * The demo world (#3): two simulated competitions scored by the real engine (#2).
 *
 * Everything is synthetic and deterministic for a given state and clock. The Demo Scoring
 * Settings only change the rules object passed to these demo competitions; `RULES_V1` and the
 * engine are untouched.
 */

export interface DemoCompetitionSpec {
  categoryId: CategoryId;
  /** Offsets from the demo anchor date (inclusive). */
  startOffset: number;
  endOffset: number;
}

/** Step Battle: 7 days, live (day 3 when the demo starts). Calorie Clash: 3 days, finished. */
export const DEMO_COMPETITIONS: readonly DemoCompetitionSpec[] = Object.freeze([
  { categoryId: 'step-battle', startOffset: -2, endOffset: 4 },
  { categoryId: 'calorie-clash', startOffset: -5, endOffset: -3 },
]);

/**
 * Calorie Clash uses fixed multiples of each player's typical day, so that with the default
 * settings You and Maya tie for first (shows how shared places work).
 */
const CALORIE_CLASH_SCRIPT: Record<DemoPlayerId, number[]> = {
  you: [1.2, 1.1, 0.9],
  maya: [1.2, 1.0, 1.0],
  jordan: [0.9, 1.0, 0.8],
  sam: [1.05, 0.7, 0.95],
  alex: [0.95, 1.05, 0.85],
};

export interface DemoCompetition {
  id: string;
  categoryId: CategoryId;
  name: string;
  unit: string;
  competition: Competition;
  result: CompetitionResult;
  /** 1-based index of the demo's current day within the competition, or null outside it. */
  currentDay: number | null;
  totalDays: number;
  windowEnd: number;
  finalizesAt: number;
}

export interface DemoDayActivity {
  date: string;
  steps: number;
  activeEnergyKcal: number;
}

export interface DemoWorld {
  nowMs: number;
  timeZone: string;
  /** The demo's current date in `timeZone`. */
  today: string;
  competitions: DemoCompetition[];
  /** Your activity today (so far) and the six days before, newest first. */
  yourDays: DemoDayActivity[];
  /** True when any Demo Scoring Setting differs from the production defaults. */
  usesDemoSettings: boolean;
  /** Demo clock targets for the "Jump ahead" controls (null when already past). */
  jumps: { nextDay: number; endOfStepBattle: number | null; finalStepBattle: number | null };
}

export function demoRules(state: DemoState): ScoringRules {
  const { dailyCapPoints, pointsPerGoal } = state.settings;
  if (dailyCapPoints === RULES_V1.dailyCapPoints && pointsPerGoal === RULES_V1.pointsPerGoal) {
    return RULES_V1;
  }
  return { ...RULES_V1, version: `${RULES_V1.version}-demo`, dailyCapPoints, pointsPerGoal };
}

/** Full-day synthetic activity for a player, category and date (before "today so far" scaling). */
export function fullDayActivity(
  state: DemoState,
  player: DemoPlayer,
  categoryId: CategoryId,
  date: string,
): number {
  const typical = typicalDay(player, categoryId);
  if (categoryId === 'calorie-clash') {
    const spec = DEMO_COMPETITIONS.find((c) => c.categoryId === 'calorie-clash');
    if (spec) {
      const start = addDays(state.anchorDate, spec.startOffset);
      const index = Math.round((Date.parse(date) - Date.parse(start)) / 86_400_000);
      const factor = CALORIE_CLASH_SCRIPT[player.id][index];
      if (factor !== undefined && index <= spec.endOffset - spec.startOffset) {
        return Math.round(typical * factor);
      }
    }
  }
  const random = createRandom(`demo|${state.seed}|${categoryId}|${player.id}|${date}`);
  return Math.round(typical * dailyMultiplier(random, PROFILES[player.profile].cv));
}

function dayBounds(date: string, timeZone: string) {
  return { start: startOfDay(date, timeZone), end: startOfDay(addDays(date, 1), timeZone) };
}

/** Activity on `date` as known at `nowMs`: partial for the current day, plus demo additions. */
function activityAt(
  state: DemoState,
  player: DemoPlayer,
  categoryId: CategoryId,
  date: string,
  nowMs: number,
  timeZone: string,
): number {
  const { start, end } = dayBounds(date, timeZone);
  if (start > nowMs) return 0;
  const elapsed = Math.min(1, (nowMs - start) / (end - start));
  const base = Math.round(fullDayActivity(state, player, categoryId, date) * elapsed);
  const added = player.id === YOU ? (state.added[categoryId][date] ?? 0) : 0;
  return base + added;
}

/**
 * The goal a player competes with: their demo goal setting, raised to their usual day in a
 * usual-day competition (the app's goal step won't go lower when history is reliable, #32).
 */
export function effectiveGoal(
  state: DemoState,
  player: DemoPlayer,
  categoryId: CategoryId,
): { goal: number; minimum: number | null } {
  const requested = state.settings.goals[categoryId][player.id];
  const usual = playerUsualDay(player, categoryId);
  const minimum = state.goalModes[categoryId] === 'usual-day' ? usual.goal : null;
  return { goal: minimum === null ? requested : Math.max(requested, minimum), minimum };
}

function buildCompetition(
  state: DemoState,
  spec: DemoCompetitionSpec,
  nowMs: number,
  timeZone: string,
): DemoCompetition {
  const category = CATEGORIES[spec.categoryId];
  const startDate = addDays(state.anchorDate, spec.startOffset);
  const endDate = addDays(state.anchorDate, spec.endOffset);
  const rules = demoRules(state);
  const joinedAt = new Date(startOfDay(addDays(startDate, -1), timeZone)).toISOString();

  const competition = startCompetition({
    id: `demo-${spec.categoryId}`,
    categoryId: spec.categoryId,
    timeZone,
    startDate,
    endDate,
    rules,
    participants: DEMO_PLAYERS.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      joinedAt,
      profileGoal: effectiveGoal(state, p, spec.categoryId).goal,
      history: playerHistory(p, spec.categoryId, startDate),
    })),
    goalMode: state.goalModes[spec.categoryId],
  });
  const { dates, windowEnd, finalizesAt } = competitionWindow(competition);

  const records: ActivityRecord[] = [];
  const syncStates: SyncState[] = [];
  for (const player of DEMO_PLAYERS) {
    const lagMs = player.syncLagHours * 3_600_000;
    for (const date of dates) {
      const { start, end } = dayBounds(date, timeZone);
      if (start > nowMs) break;
      const dayDone = nowMs >= end;
      // A lagging phone only delivers whole days, `lagMs` after they end.
      if (lagMs > 0 && (!dayDone || end + lagMs > nowMs)) continue;
      const recordEnd = dayDone ? end : nowMs;
      records.push({
        id: `${player.id}-${date}`,
        participantId: player.id,
        metric: category.metric,
        value: activityAt(state, player, spec.categoryId, date, nowMs, timeZone),
        start: new Date(start).toISOString(),
        end: new Date(recordEnd).toISOString(),
        type: 'daily-total',
        aggregation: 'platform-deduplicated',
        source: {
          kind: 'phone',
          platform: 'simulated',
          recordingMethod: 'automatic',
          deviceId: `demo-${player.id}`,
        },
        receivedAt: new Date(recordEnd + lagMs).toISOString(),
      });
    }
    syncStates.push({
      participantId: player.id,
      syncedThrough: new Date(nowMs - lagMs).toISOString(),
      permission: 'granted',
    });
  }

  // Your first day also shows how the rules treat questionable records (privately).
  const first = dayBounds(startDate, timeZone);
  if (first.end <= nowMs) {
    const at = (h: number) => new Date(first.start + h * 3_600_000).toISOString();
    const typical = typicalDay(DEMO_PLAYERS[0], spec.categoryId);
    records.push(
      {
        id: `you-${startDate}-manual`,
        participantId: YOU,
        metric: category.metric,
        value: Math.round(typical * 0.3),
        start: at(18),
        end: at(19),
        type: 'sample',
        source: { kind: 'phone', platform: 'simulated', recordingMethod: 'manual' },
        receivedAt: at(19),
      },
      {
        id: `you-${startDate}-unknown`,
        participantId: YOU,
        metric: category.metric,
        value: Math.round(typical * 0.15),
        start: at(7),
        end: at(8),
        type: 'sample',
        source: { kind: 'unknown', platform: 'simulated', recordingMethod: 'automatic' },
        receivedAt: at(8),
      },
    );
  }

  const result = scoreCompetition(competition, records, syncStates, new Date(nowMs).toISOString());
  const today = dayOf(nowMs, timeZone);
  const index = dates.indexOf(today);
  return {
    id: competition.id,
    categoryId: spec.categoryId,
    name: category.name,
    unit: spec.categoryId === 'step-battle' ? 'steps' : 'kcal',
    competition,
    result,
    currentDay: index === -1 ? null : index + 1,
    totalDays: dates.length,
    windowEnd,
    finalizesAt,
  };
}

export function buildDemoWorld(state: DemoState, realNowMs: number, timeZone: string): DemoWorld {
  const nowMs = realNowMs + state.clockOffsetMs;
  const today = dayOf(nowMs, timeZone);
  const competitions = DEMO_COMPETITIONS.map((spec) =>
    buildCompetition(state, spec, nowMs, timeZone),
  );
  const you = DEMO_PLAYERS[0];
  const yourDays = Array.from({ length: 7 }, (_, i): DemoDayActivity => {
    const date = addDays(today, -i);
    return {
      date,
      steps: activityAt(state, you, 'step-battle', date, nowMs, timeZone),
      activeEnergyKcal: activityAt(state, you, 'calorie-clash', date, nowMs, timeZone),
    };
  });
  const stepBattle = competitions.find((c) => c.categoryId === 'step-battle');
  const todayBounds = dayBounds(today, timeZone);
  const nextDay = dayBounds(addDays(today, 1), timeZone).start + (nowMs - todayBounds.start);
  const later = (ms: number | undefined) => (ms !== undefined && ms > nowMs ? ms : null);
  return {
    nowMs,
    timeZone,
    today,
    competitions,
    yourDays,
    usesDemoSettings: settingsChanged(state.settings),
    jumps: {
      nextDay,
      // One hour into the 24-hour grace period, and one minute after results become final.
      endOfStepBattle: later(stepBattle && stepBattle.windowEnd + 3_600_000),
      finalStepBattle: later(stepBattle && stepBattle.finalizesAt + 60_000),
    },
  };
}

export function standingFor(competition: DemoCompetition, participantId: string): Standing {
  const standing = competition.result.standings.find((s) => s.participantId === participantId);
  if (!standing) throw new Error(`No standing for ${participantId}`);
  return standing;
}

/** Standings ordered for display: rank, then name. */
export function orderedStandings(competition: DemoCompetition): Standing[] {
  return [...competition.result.standings].sort(
    (a, b) =>
      (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.displayName.localeCompare(b.displayName),
  );
}

/** Players sharing `standing`'s rank (excluding itself). */
export function tiedWith(competition: DemoCompetition, standing: Standing): Standing[] {
  return competition.result.standings.filter(
    (s) => s !== standing && s.rank !== null && s.rank === standing.rank,
  );
}
