import { startCompetition, type NewParticipant } from '../engine';
import type { ActivityRecord, CategoryId, SourceProvenance } from '../types';

export const WATCH: SourceProvenance = {
  kind: 'watch',
  platform: 'healthkit',
  recordingMethod: 'automatic',
  deviceId: 'apple-watch-1',
};
export const PHONE: SourceProvenance = {
  kind: 'phone',
  platform: 'healthkit',
  recordingMethod: 'automatic',
  deviceId: 'iphone-1',
};

let counter = 0;

/** A record; defaults to a full-day platform total of steps from a watch. */
export function rec(
  overrides: Partial<ActivityRecord> & Pick<ActivityRecord, 'participantId'>,
): ActivityRecord {
  counter += 1;
  return {
    id: `r${counter}`,
    metric: 'steps',
    value: 0,
    start: '2026-11-02T06:00:00Z', // 00:00 in America/Chicago (CST, UTC-6)
    end: '2026-11-03T06:00:00Z',
    type: 'daily-total',
    source: WATCH,
    receivedAt: '2026-11-03T07:00:00Z',
    ...overrides,
  };
}

export function person(
  id: string,
  profileGoal: number,
  extra: Partial<NewParticipant> = {},
): NewParticipant {
  return { id, displayName: id, joinedAt: '2026-11-01T00:00:00Z', profileGoal, ...extra };
}

/** A 7-day Step Battle in Chicago, Mon 2 Nov – Sun 8 Nov 2026. */
export function stepBattle(participants: NewParticipant[], categoryId: CategoryId = 'step-battle') {
  return startCompetition({
    id: 'c1',
    categoryId,
    timeZone: 'America/Chicago',
    startDate: '2026-11-02',
    endDate: '2026-11-08',
    participants,
  });
}

/** Chicago local midnight (UTC-6 in November) for a date in the test competition. */
export function chicagoMidnight(date: string): string {
  return `${date}T06:00:00Z`;
}

/** A platform daily total for a participant on a date. */
export function dayTotal(
  participantId: string,
  date: string,
  value: number,
  extra: Partial<ActivityRecord> = {},
) {
  const start = chicagoMidnight(date);
  const end = new Date(Date.parse(start) + 24 * 3600 * 1000).toISOString();
  return rec({ participantId, value, start, end, receivedAt: end, ...extra });
}

export const AFTER_FINAL = '2026-11-12T00:00:00Z';
export const synced = (participantId: string, through = '2026-11-09T06:00:00Z') => ({
  participantId,
  syncedThrough: through,
  permission: 'granted' as const,
});
