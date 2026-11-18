import { scoreCompetition, startCompetition } from '../engine';
import { usualDayGoal } from '../goals';
import { CATEGORIES, RULES_V1 } from '../rules';
import { addDays, startOfDay } from '../time';
import type {
  ActivityRecord,
  CategoryId,
  CompetitionResult,
  GoalMode,
  HistoryDay,
  Standing,
  SyncState,
} from '../types';
import { PROFILES, type ProfileId } from './profiles';
import { createRandom, dailyMultiplier } from './random';

/**
 * Simulated competitions built only from synthetic data and scored by the real engine
 * (`scoreCompetition`). Nothing here reads health data or changes scoring rules.
 */

export const SIM_TIME_ZONE = 'America/Chicago';
export const SIM_START = '2026-11-02'; // a Monday, no DST change within 7 days

export interface PlayerSpec {
  id: string;
  profile: ProfileId;
  /** Daily goal as a multiple of the profile's typical day (1 = honest goal, 0.5 = easy). */
  goalFactor: number;
  /** Day indexes (0-based) with a confirmed zero (e.g. sick, forgot the device). */
  missedDays?: number[];
  /** Day indexes with an exceptional day: activity multiplied by `factor`. */
  exceptionalDays?: { day: number; factor: number }[];
  /** Override activity per day (exact values) — for hand-built scenarios. */
  fixedActivity?: number[];
}

export interface ScenarioSpec {
  categoryId: CategoryId;
  days: number;
  players: PlayerSpec[];
  seed: string;
  /**
   * Goal mode (#32). In `usual-day` mode a player who asks for a goal below their reliable usual
   * day gets their usual day instead (what the app's goal step enforces). Default `choose-own`.
   */
  goalMode?: GoalMode;
}

export interface SimulatedCompetition {
  spec: ScenarioSpec;
  result: CompetitionResult;
  goals: Record<string, number>;
}

function historyFor(
  player: PlayerSpec,
  metricMean: number,
  cv: number,
  seed: string,
): HistoryDay[] {
  const random = createRandom(`${seed}|history|${player.id}`);
  return Array.from({ length: 28 }, (_, i) => ({
    date: addDays(SIM_START, -1 - i),
    value: Math.round(metricMean * dailyMultiplier(random, cv)),
  }));
}

export function simulateCompetition(spec: ScenarioSpec): SimulatedCompetition {
  const category = CATEGORIES[spec.categoryId];
  const endDate = addDays(SIM_START, spec.days - 1);
  const goals: Record<string, number> = {};

  const competition = startCompetition({
    id: `sim-${spec.seed}`,
    categoryId: spec.categoryId,
    timeZone: SIM_TIME_ZONE,
    startDate: SIM_START,
    endDate,
    participants: spec.players.map((p) => {
      const profile = PROFILES[p.profile];
      const mean = profile.mean[category.metric];
      const step = category.metric === 'steps' ? 100 : 10;
      const requested = Math.max(step, Math.round((mean * p.goalFactor) / step) * step);
      const history = historyFor(p, mean, profile.cv, spec.seed);
      const usual = usualDayGoal(history, category.metric, RULES_V1);
      const goal =
        spec.goalMode === 'usual-day' && usual.goal !== null
          ? Math.max(requested, usual.goal)
          : requested;
      goals[p.id] = goal;
      return {
        id: p.id,
        displayName: p.id,
        joinedAt: `${addDays(SIM_START, -1)}T12:00:00Z`,
        profileGoal: goal,
        history,
      };
    }),
    goalMode: spec.goalMode,
  });

  const records: ActivityRecord[] = [];
  const sync: SyncState[] = [];
  for (const p of spec.players) {
    const profile = PROFILES[p.profile];
    const mean = profile.mean[category.metric];
    const random = createRandom(`${spec.seed}|activity|${p.id}`);
    for (let day = 0; day < spec.days; day++) {
      const date = addDays(SIM_START, day);
      const start = startOfDay(date, SIM_TIME_ZONE);
      const end = startOfDay(addDays(date, 1), SIM_TIME_ZONE);
      // Always draw, so missed/exceptional days don't shift the other days' values.
      let value = Math.round(mean * dailyMultiplier(random, profile.cv));
      if (p.fixedActivity) value = p.fixedActivity[day] ?? 0;
      const exceptional = p.exceptionalDays?.find((e) => e.day === day);
      if (exceptional) value = Math.round(value * exceptional.factor);
      if (p.missedDays?.includes(day)) value = 0;
      records.push({
        id: `${p.id}-${day}`,
        participantId: p.id,
        metric: category.metric,
        value,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        type: 'daily-total',
        aggregation: 'platform-deduplicated',
        source: {
          kind: 'watch',
          platform: 'simulated',
          recordingMethod: 'automatic',
          deviceId: `sim-${p.id}`,
        },
        receivedAt: new Date(end).toISOString(),
      });
    }
    sync.push({
      participantId: p.id,
      syncedThrough: new Date(startOfDay(addDays(endDate, 1), SIM_TIME_ZONE)).toISOString(),
      permission: 'granted',
    });
  }

  const final = new Date(startOfDay(addDays(endDate, 3), SIM_TIME_ZONE)).toISOString();
  return { spec, result: scoreCompetition(competition, records, sync, final), goals };
}

export function standingOf(sim: SimulatedCompetition, id: string): Standing {
  const s = sim.result.standings.find((x) => x.participantId === id);
  if (!s) throw new Error(`no standing for ${id}`);
  return s;
}

// ---------------------------------------------------------------------------------------------
// Monte Carlo aggregation
// ---------------------------------------------------------------------------------------------

export interface PlayerStats {
  id: string;
  /** Share of competitions won; a shared first place counts as 1/k of a win for each of k. */
  winShare: number;
  meanPoints: number;
  /** Share of days scored at the 200-point cap. */
  cappedDayShare: number;
  /** Share of competitions where a future-goal suggestion was made. */
  suggestionRate: number;
  /** Fairness band at start (identical across runs for a given spec seed family). */
  fairnessBands: Record<string, number>;
}

export interface MonteCarloResult {
  runs: number;
  players: PlayerStats[];
  /** Share of competitions with a tie for first place. */
  firstPlaceTieRate: number;
}

export function monteCarlo(
  runs: number,
  makeSpec: (run: number) => ScenarioSpec,
): MonteCarloResult {
  const totals = new Map<
    string,
    {
      wins: number;
      points: number;
      capped: number;
      days: number;
      suggestions: number;
      bands: Record<string, number>;
    }
  >();
  let ties = 0;
  for (let run = 0; run < runs; run++) {
    const sim = simulateCompetition(makeSpec(run));
    const ranked = sim.result.standings.filter((s) => s.rank !== null);
    const winners = ranked.filter((s) => s.rank === 1);
    if (winners.length > 1) ties += 1;
    for (const s of sim.result.standings) {
      const t = totals.get(s.participantId) ?? {
        wins: 0,
        points: 0,
        capped: 0,
        days: 0,
        suggestions: 0,
        bands: {},
      };
      if (s.rank === 1) t.wins += 1 / winners.length;
      t.points += s.totalPoints;
      t.capped += s.days.filter((d) => d.capped).length;
      t.days += s.days.length;
      if (s.goalSuggestion) t.suggestions += 1;
      const band = s.fairnessAtStart?.band ?? 'none';
      t.bands[band] = (t.bands[band] ?? 0) + 1;
      totals.set(s.participantId, t);
    }
  }
  return {
    runs,
    firstPlaceTieRate: ties / runs,
    players: [...totals.entries()].map(([id, t]) => ({
      id,
      winShare: t.wins / runs,
      meanPoints: t.points / runs,
      cappedDayShare: t.capped / t.days,
      suggestionRate: t.suggestions / runs,
      fairnessBands: Object.fromEntries(Object.entries(t.bands).map(([b, n]) => [b, n / runs])),
    })),
  };
}

export function statsOf(mc: MonteCarloResult, id: string): PlayerStats {
  const s = mc.players.find((p) => p.id === id);
  if (!s) throw new Error(`no stats for ${id}`);
  return s;
}
