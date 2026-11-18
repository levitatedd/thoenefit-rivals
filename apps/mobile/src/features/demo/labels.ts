import { fromDateKey } from '@/features/activity';
import type { DayStatus, GoalMode, Phase, PublicGoalLabel, Standing } from '@/features/scoring';
import { formatShortDate, ordinal } from '@/utils/format';

import type { DemoCompetition } from './world';

export const PHASE_LABELS: Record<Phase, string> = {
  'not-started': 'Starts soon',
  'in-progress': 'In progress',
  grace: 'Waiting for late syncs',
  final: 'Final',
};

export function dayStatusLabel(status: DayStatus, isToday: boolean): string {
  switch (status) {
    case 'confirmed':
      return 'Confirmed';
    case 'pending':
      return isToday ? 'Today · so far' : 'Waiting for sync';
    case 'no-data':
      return 'No data';
    case 'permission-revoked':
      return 'No permission';
    case 'future':
      return 'Upcoming';
    case 'withdrawn':
      return 'Withdrawn';
  }
}

/** "1st", "Shared 1st", or "Withdrawn". */
export function placeLabel(competition: DemoCompetition, standing: Standing): string {
  if (standing.rank === null) return 'Withdrawn';
  const shared = competition.result.standings.some(
    (s) => s !== standing && s.rank === standing.rank,
  );
  return `${shared ? 'Shared ' : ''}${ordinal(standing.rank)}`;
}

/** "Mon, Nov 16 – Sun, Nov 22". */
export function dateRangeLabel(competition: DemoCompetition): string {
  const { startDate, endDate } = competition.competition;
  return `${formatShortDate(fromDateKey(startDate))} – ${formatShortDate(fromDateKey(endDate))}`;
}

/** "Day 3 of 7", "Starts soon", "Waiting for late syncs" or "Final". */
export function progressLabel(competition: DemoCompetition): string {
  if (competition.result.phase === 'in-progress' && competition.currentDay !== null) {
    return `Day ${competition.currentDay} of ${competition.totalDays}`;
  }
  return PHASE_LABELS[competition.result.phase];
}

/** Neutral wording for the public goal label (#32). Never numbers or history. */
export const GOAL_LABELS: Record<PublicGoalLabel, string> = {
  'usual-day': 'usual-day goal',
  'near-usual': 'goal near usual',
  'below-usual': 'goal below usual',
  'above-usual': 'goal above usual',
  'limited-history': 'limited history',
};

export const GOAL_MODE_LABELS: Record<GoalMode, string> = {
  'usual-day': 'Usual-day goals',
  'choose-own': 'Choose-your-own goals',
};

/** One-line explanation of a competition's goal mode, for participants. */
export const GOAL_MODE_EXPLANATIONS: Record<GoalMode, string> = {
  'usual-day':
    'Usual-day goals: each goal starts at that player’s own usual day and can only be raised, so nobody can win with an easy goal. Players with limited history choose their own goal.',
  'choose-own':
    'Choose-your-own goals: players picked any goal. Labels compare each goal with that player’s own usual day, without sharing any history.',
};
