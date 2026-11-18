import { dayOf } from './time';
import type {
  ActivityRecord,
  Competition,
  EligibilityDecision,
  ReasonCode,
  ScoringRules,
  SourceProvenance,
} from './types';

/**
 * Decides, for each activity record, whether it counts (`eligible`), is `excluded`, or is
 * `held` pending clarification. Held records don't count, but they never block the rest of the
 * day's valid activity.
 *
 * Order of checks for a single record:
 *  1. unknown participant / malformed value or timestamps → INVALID_RECORD
 *  2. wrong metric for the competition → UNSUPPORTED_METRIC
 *  3. received after the finalization deadline → LATE_SYNC
 *  4. started outside the competition window → OUTSIDE_COMPETITION
 *  5. manual entry → MANUAL_ENTRY
 *  6. workout record (already contained in daily totals) → DUPLICATE_ACTIVITY
 *  7. unidentifiable source, or an import without provenance → held UNKNOWN_SOURCE
 * Then, across records of one participant and day:
 *  8. repeated record ids / identical copies → DUPLICATE_ACTIVITY
 *  9. a platform daily total wins; other totals and individual samples that day are duplicates
 * 10. overlapping samples from different sources: the higher-priority source wins; equal
 *     priority → both held OVERLAP_UNRESOLVED. Overlaps within one source are not duplicates.
 *
 * A record is assigned to the competition day containing its start instant.
 */

export const EXPLANATIONS: Readonly<Record<ReasonCode, string>> = Object.freeze({
  MANUAL_ENTRY: 'Manually entered activity is not counted in competitions.',
  DUPLICATE_ACTIVITY:
    'This activity is already counted from another record, so it was not added again.',
  UNKNOWN_SOURCE: 'We could not identify where this activity came from, so it is on hold.',
  OVERLAP_UNRESOLVED:
    'This activity overlaps activity from another device and we could not tell which one to count, so it is on hold.',
  OUTSIDE_COMPETITION: 'This activity happened outside the competition dates.',
  UNSUPPORTED_METRIC: 'This type of activity is not scored in this competition.',
  INVALID_RECORD: 'This record looks invalid (for example a negative amount or broken timestamps).',
  LATE_SYNC:
    'This activity arrived after the competition was finalized, so final results did not change.',
});

export interface EligibilityContext {
  competition: Competition;
  /** Competition window [windowStart, windowEnd) in epoch ms. */
  windowStart: number;
  windowEnd: number;
  /** Records received after this instant are never counted. */
  finalizesAt: number;
}

interface Candidate {
  record: ActivityRecord;
  start: number;
  end: number;
  day: string;
}

function sourceIdentity(source: SourceProvenance): string {
  return [source.platform, source.kind, source.deviceId ?? '', source.appId ?? ''].join('|');
}

function priorityOf(source: SourceProvenance, rules: ScoringRules): number {
  const index = rules.sourcePriority.indexOf(source.kind);
  return index === -1 ? -1 : index;
}

function decision(
  record: ActivityRecord,
  status: EligibilityDecision['status'],
  reason?: ReasonCode,
  day?: string,
): EligibilityDecision {
  return {
    recordId: record.id,
    participantId: record.participantId,
    status,
    ...(day ? { day } : {}),
    ...(reason ? { reason, explanation: EXPLANATIONS[reason] } : {}),
  };
}

/** Checks 1–7: decisions that depend on a single record; otherwise returns a candidate. */
function checkRecord(
  record: ActivityRecord,
  ctx: EligibilityContext,
): EligibilityDecision | Candidate {
  const { competition } = ctx;
  if (!competition.participants.some((p) => p.id === record.participantId)) {
    return decision(record, 'excluded', 'INVALID_RECORD');
  }
  const start = Date.parse(record.start);
  const end = Date.parse(record.end);
  const received = Date.parse(record.receivedAt);
  if (
    typeof record.value !== 'number' ||
    !Number.isFinite(record.value) ||
    record.value < 0 ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    !Number.isFinite(received) ||
    end < start
  ) {
    return decision(record, 'excluded', 'INVALID_RECORD');
  }
  if (record.metric !== competition.category.metric) {
    return decision(record, 'excluded', 'UNSUPPORTED_METRIC');
  }
  const inWindow = start >= ctx.windowStart && start < ctx.windowEnd;
  const day = inWindow ? dayOf(start, competition.timeZone) : undefined;
  if (received > ctx.finalizesAt) return decision(record, 'excluded', 'LATE_SYNC', day);
  if (!inWindow) return decision(record, 'excluded', 'OUTSIDE_COMPETITION');
  if (record.source.recordingMethod === 'manual')
    return decision(record, 'excluded', 'MANUAL_ENTRY', day);
  if (record.type === 'workout') return decision(record, 'excluded', 'DUPLICATE_ACTIVITY', day);
  const { source } = record;
  const identifiable =
    source.kind !== 'unknown' &&
    source.recordingMethod === 'automatic' &&
    (source.kind !== 'third-party-import' || Boolean(source.appId));
  if (!identifiable) return decision(record, 'held', 'UNKNOWN_SOURCE', day);
  return { record, start, end, day: day as string };
}

function isCandidate(value: EligibilityDecision | Candidate): value is Candidate {
  return 'record' in value;
}

/** Checks 8–10 for one participant-day. */
function resolveDay(candidates: Candidate[], rules: ScoringRules): EligibilityDecision[] {
  const out: EligibilityDecision[] = [];
  const unique: Candidate[] = [];
  const seenIds = new Set<string>();
  const seenContent = new Set<string>();
  for (const c of candidates) {
    const content = [
      c.record.type,
      c.start,
      c.end,
      c.record.value,
      sourceIdentity(c.record.source),
    ].join('|');
    if (seenIds.has(c.record.id) || seenContent.has(content)) {
      out.push(decision(c.record, 'excluded', 'DUPLICATE_ACTIVITY', c.day));
      continue;
    }
    seenIds.add(c.record.id);
    seenContent.add(content);
    unique.push(c);
  }

  // 9. A platform-aggregated daily total is already de-duplicated across sources: prefer it.
  const totals = unique.filter((c) => c.record.type === 'daily-total');
  if (totals.length > 0) {
    const chosen = [...totals].sort(
      (a, b) =>
        Date.parse(b.record.receivedAt) - Date.parse(a.record.receivedAt) ||
        a.record.id.localeCompare(b.record.id),
    )[0];
    for (const c of unique) {
      out.push(
        c === chosen
          ? decision(c.record, 'eligible', undefined, c.day)
          : decision(c.record, 'excluded', 'DUPLICATE_ACTIVITY', c.day),
      );
    }
    return out;
  }

  // 10. Samples: resolve cross-source overlaps by source priority, deterministically.
  const samples = [...unique].sort(
    (a, b) =>
      priorityOf(b.record.source, rules) - priorityOf(a.record.source, rules) ||
      a.start - b.start ||
      a.record.id.localeCompare(b.record.id),
  );
  const status = new Map<
    Candidate,
    { status: EligibilityDecision['status']; reason?: ReasonCode }
  >();
  const accepted: Candidate[] = [];
  for (const s of samples) {
    const overlapping = accepted.filter(
      (a) =>
        sourceIdentity(a.record.source) !== sourceIdentity(s.record.source) &&
        s.start < a.end &&
        a.start < s.end,
    );
    if (overlapping.length === 0) {
      status.set(s, { status: 'eligible' });
      accepted.push(s);
      continue;
    }
    const sPriority = priorityOf(s.record.source, rules);
    const higher = overlapping.some((a) => priorityOf(a.record.source, rules) > sPriority);
    if (higher) {
      status.set(s, { status: 'excluded', reason: 'DUPLICATE_ACTIVITY' });
    } else {
      // Equal priority, different sources: we can't tell which is right. Hold both.
      status.set(s, { status: 'held', reason: 'OVERLAP_UNRESOLVED' });
      for (const a of overlapping) status.set(a, { status: 'held', reason: 'OVERLAP_UNRESOLVED' });
    }
  }
  for (const c of unique) {
    const s = status.get(c)!;
    out.push(decision(c.record, s.status, s.reason, c.day));
  }
  return out;
}

export function evaluateEligibility(
  records: ActivityRecord[],
  ctx: EligibilityContext,
): EligibilityDecision[] {
  const decisions: EligibilityDecision[] = [];
  const groups = new Map<string, Candidate[]>();
  for (const record of records) {
    const result = checkRecord(record, ctx);
    if (!isCandidate(result)) {
      decisions.push(result);
      continue;
    }
    const key = `${record.participantId}|${result.day}`;
    const group = groups.get(key) ?? [];
    group.push(result);
    groups.set(key, group);
  }
  for (const group of groups.values()) decisions.push(...resolveDay(group, ctx.competition.rules));
  // Stable output order: by participant, day, then record id.
  return decisions.sort(
    (a, b) =>
      a.participantId.localeCompare(b.participantId) ||
      (a.day ?? '').localeCompare(b.day ?? '') ||
      a.recordId.localeCompare(b.recordId),
  );
}
