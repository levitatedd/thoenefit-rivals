import { fromDateKey } from '@/features/activity';
import type { DayStatus, Phase, Standing } from '@/features/scoring';
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
