import {
  CATEGORIES,
  RULES_V1,
  addDays,
  usualDayGoal,
  type CategoryId,
  type HistoryDay,
  type UsualDay,
} from '@/features/scoring';
import { PROFILES, type ProfileId } from '@/features/scoring/simulation/profiles';
import { createRandom, dailyMultiplier } from '@/features/scoring/simulation/random';

/** Simulated demo participants. Invented people with synthetic activity only. */
export type DemoPlayerId = 'you' | 'maya' | 'jordan' | 'sam' | 'alex';

export interface DemoPlayer {
  id: DemoPlayerId;
  displayName: string;
  profile: ProfileId;
  /** Hours after a day ends before this player's phone syncs it (models a slow sync). */
  syncLagHours: number;
  /** Days of activity history before a competition (28 = full; fewer = new to tracking). */
  historyDays: number;
}

export const YOU: DemoPlayerId = 'you';

export const DEMO_PLAYERS: readonly DemoPlayer[] = Object.freeze([
  { id: 'you', displayName: 'You', profile: 'moderate', syncLagHours: 0, historyDays: 28 },
  // Maya is new to tracking (9 days of history): she picks her own goal and is labelled
  // "Limited history", never "below usual" (#32).
  { id: 'maya', displayName: 'Maya', profile: 'light', syncLagHours: 0, historyDays: 9 },
  { id: 'jordan', displayName: 'Jordan', profile: 'active', syncLagHours: 0, historyDays: 28 },
  { id: 'sam', displayName: 'Sam', profile: 'athlete', syncLagHours: 0, historyDays: 28 },
  // Alex's phone syncs a day late, so the demo shows "waiting for sync" and the grace period.
  { id: 'alex', displayName: 'Alex', profile: 'moderate', syncLagHours: 20, historyDays: 28 },
]);

/** Typical full day for a player in a category's metric. */
export function typicalDay(player: DemoPlayer, categoryId: CategoryId): number {
  return PROFILES[player.profile].mean[CATEGORIES[categoryId].metric];
}

/**
 * Synthetic history before a competition starting on `start` (the 28 days before it; days the
 * player wasn't tracking yet are missing, not zero). Values depend only on player and category.
 */
export function playerHistory(
  player: DemoPlayer,
  categoryId: CategoryId,
  start: string,
): HistoryDay[] {
  const random = createRandom(`demo-history|${categoryId}|${player.id}`);
  const typical = typicalDay(player, categoryId);
  return Array.from({ length: 28 }, (_, i): HistoryDay => {
    const value = Math.round(typical * dailyMultiplier(random, PROFILES[player.profile].cv));
    return { date: addDays(start, -1 - i), value: i < player.historyDays ? value : null };
  });
}

/** The player's usual day (#32); independent of dates, since history values aren't. */
export function playerUsualDay(player: DemoPlayer, categoryId: CategoryId): UsualDay {
  return usualDayGoal(
    playerHistory(player, categoryId, '2026-01-01'),
    CATEGORIES[categoryId].metric,
    RULES_V1,
  );
}

/**
 * Default demo goal: the player's usual day when it can be estimated (what usual-day mode would
 * set), otherwise their typical day. The Calorie Clash keeps typical days, so its scripted
 * shared first place still happens.
 */
export function defaultGoal(player: DemoPlayer, categoryId: CategoryId): number {
  if (categoryId === 'calorie-clash') return typicalDay(player, categoryId);
  return playerUsualDay(player, categoryId).goal ?? typicalDay(player, categoryId);
}

export function playerById(id: string): DemoPlayer | undefined {
  return DEMO_PLAYERS.find((p) => p.id === id);
}
