import { CATEGORIES, type CategoryId } from '@/features/scoring';
import { PROFILES, type ProfileId } from '@/features/scoring/simulation/profiles';

/** Simulated demo participants. Invented people with synthetic activity only. */
export type DemoPlayerId = 'you' | 'maya' | 'jordan' | 'sam' | 'alex';

export interface DemoPlayer {
  id: DemoPlayerId;
  displayName: string;
  profile: ProfileId;
  /** Hours after a day ends before this player's phone syncs it (models a slow sync). */
  syncLagHours: number;
}

export const YOU: DemoPlayerId = 'you';

export const DEMO_PLAYERS: readonly DemoPlayer[] = Object.freeze([
  { id: 'you', displayName: 'You', profile: 'moderate', syncLagHours: 0 },
  { id: 'maya', displayName: 'Maya', profile: 'light', syncLagHours: 0 },
  { id: 'jordan', displayName: 'Jordan', profile: 'active', syncLagHours: 0 },
  { id: 'sam', displayName: 'Sam', profile: 'athlete', syncLagHours: 0 },
  // Alex's phone syncs a day late, so the demo shows "waiting for sync" and the grace period.
  { id: 'alex', displayName: 'Alex', profile: 'moderate', syncLagHours: 20 },
]);

/** Typical full day for a player in a category's metric. */
export function typicalDay(player: DemoPlayer, categoryId: CategoryId): number {
  return PROFILES[player.profile].mean[CATEGORIES[categoryId].metric];
}

/** Default demo goal: the player's typical day (an honest goal). */
export function defaultGoal(player: DemoPlayer, categoryId: CategoryId): number {
  return typicalDay(player, categoryId);
}

export function playerById(id: string): DemoPlayer | undefined {
  return DEMO_PLAYERS.find((p) => p.id === id);
}
