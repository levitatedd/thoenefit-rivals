import { addDays, dayOf, startOfDay } from './time';
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
 * Principle: a record is only excluded as a duplicate on **evidence** that it is the same
 * activity as one already counted. Overlapping timestamps alone are not evidence; an
 * overlapping contribution from another source is held instead.
 *
 * Order of checks for a single record:
 *  1. unknown participant / malformed value or timestamps → INVALID_RECORD
 *  2. wrong metric for the competition → UNSUPPORTED_METRIC
 *  3. received after the finalization deadline → LATE_SYNC
 *  4. entirely outside the competition window → OUTSIDE_COMPETITION
 *  5. crosses a competition-day boundary (incl. the competition start/end) → held SPANS_DAY_BOUNDARY
 *     (v1 limitation: adapters must supply day-bounded slices; we never guess a split)
 *  6. manual entry → MANUAL_ENTRY
 *  7. workout record (already contained in daily activity) → DUPLICATE_ACTIVITY
 *  8. unidentifiable source, or an import without provenance → held UNKNOWN_SOURCE
 * Then, across records of one participant and day:
 *  9. confirmed duplicates → DUPLICATE_ACTIVITY: the same record id, an identical copy from the
 *     same source, or the same `activityId` arriving through several sources (the
 *     highest-priority copy counts)
 * 10. a `platform-deduplicated` daily total (newest) covers every other record that day; other
 *     records → DUPLICATE_ACTIVITY. `single-source` totals get no such precedence.
 * 11. remaining records that overlap a counted record from a *different* source → held
 *     OVERLAP_UNRESOLVED. The record kept is chosen deterministically: higher source priority,
 *     then earlier start, then record id. Overlaps within one source are not duplicates.
 *
 * A record belongs to the competition day containing its start instant (it can't span days).
 */

export const EXPLANATIONS: Readonly<Record<ReasonCode, string>> = Object.freeze({
  MANUAL_ENTRY: 'Manually entered activity is not counted in competitions.',
  DUPLICATE_ACTIVITY:
    'This activity is already counted from another record, so it was not added again.',
  UNKNOWN_SOURCE: 'We could not identify where this activity came from, so it is on hold.',
  OVERLAP_UNRESOLVED:
    'This activity overlaps activity from another device. It might be the same activity counted twice, so it is on hold instead of being added. Your other activity still counts.',
  OUTSIDE_COMPETITION: 'This activity happened outside the competition dates.',
  UNSUPPORTED_METRIC: 'This type of activity is not scored in this competition.',
  INVALID_RECORD: 'This record looks invalid (for example a negative amount or broken timestamps).',
  LATE_SYNC:
    'This activity arrived after the competition was finalized, so final results did not change.',
  SPANS_DAY_BOUNDARY:
    'This record covers more than one competition day, so we can’t tell how much belongs to each day. It is on hold until your device provides activity for each day separately.',
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

/** Checks 1–8: decisions that depend on a single record; otherwise returns a candidate. */
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
  const startsInWindow = start >= ctx.windowStart && start < ctx.windowEnd;
  const day = startsInWindow ? dayOf(start, competition.timeZone) : undefined;
  if (received > ctx.finalizesAt) return decision(record, 'excluded', 'LATE_SYNC', day);
  // Half-open intervals: a record ending exactly at a boundary does not cross it.
  const overlapsWindow = start < ctx.windowEnd && end > ctx.windowStart;
  const zeroLengthInWindow = start === end && startsInWindow;
  if (!overlapsWindow && !zeroLengthInWindow) {
    return decision(record, 'excluded', 'OUTSIDE_COMPETITION');
  }
  if (!startsInWindow) {
    // Starts before the competition but runs into it: part may belong to day 1, part to before.
    return decision(record, 'held', 'SPANS_DAY_BOUNDARY', competition.startDate);
  }
  const nextDayStart = startOfDay(addDays(day as string, 1), competition.timeZone);
  if (end > nextDayStart) return decision(record, 'held', 'SPANS_DAY_BOUNDARY', day);
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

/** Higher priority first, then earlier start, then record id: the deterministic "keep" order. */
function keepOrder(rules: ScoringRules) {
  return (a: Candidate, b: Candidate) =>
    priorityOf(b.record.source, rules) - priorityOf(a.record.source, rules) ||
    a.start - b.start ||
    a.record.id.localeCompare(b.record.id);
}

/** Checks 9–11 for one participant-day. */
function resolveDay(candidates: Candidate[], rules: ScoringRules): EligibilityDecision[] {
  const out: EligibilityDecision[] = [];
  const exclude = (c: Candidate) =>
    out.push(decision(c.record, 'excluded', 'DUPLICATE_ACTIVITY', c.day));

  // 9a. The same record twice, or an identical copy from the same source.
  let unique: Candidate[] = [];
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
      exclude(c);
      continue;
    }
    seenIds.add(c.record.id);
    seenContent.add(content);
    unique.push(c);
  }

  // 9b. The same underlying activity (shared activityId) through several sources: keep one.
  const byActivity = new Map<string, Candidate[]>();
  for (const c of unique) {
    if (!c.record.activityId) continue;
    byActivity.set(c.record.activityId, [...(byActivity.get(c.record.activityId) ?? []), c]);
  }
  const confirmedDuplicates = new Set<Candidate>();
  for (const group of byActivity.values()) {
    const [, ...rest] = [...group].sort(keepOrder(rules));
    rest.forEach((c) => confirmedDuplicates.add(c));
  }
  confirmedDuplicates.forEach(exclude);
  unique = unique.filter((c) => !confirmedDuplicates.has(c));

  // 10. A platform-deduplicated daily total already accounts for every source that day.
  const deduplicatedTotals = unique.filter(
    (c) => c.record.type === 'daily-total' && c.record.aggregation === 'platform-deduplicated',
  );
  if (deduplicatedTotals.length > 0) {
    const chosen = [...deduplicatedTotals].sort(
      (a, b) =>
        Date.parse(b.record.receivedAt) - Date.parse(a.record.receivedAt) ||
        a.record.id.localeCompare(b.record.id),
    )[0];
    for (const c of unique) {
      if (c === chosen) out.push(decision(c.record, 'eligible', undefined, c.day));
      else exclude(c);
    }
    return out;
  }

  // 11. Overlap without evidence of duplication: count the first in keep order, hold the other.
  const accepted: Candidate[] = [];
  for (const c of [...unique].sort(keepOrder(rules))) {
    const overlapsOtherSource = accepted.some(
      (a) =>
        sourceIdentity(a.record.source) !== sourceIdentity(c.record.source) &&
        c.start < a.end &&
        a.start < c.end,
    );
    if (overlapsOtherSource) {
      out.push(decision(c.record, 'held', 'OVERLAP_UNRESOLVED', c.day));
    } else {
      accepted.push(c);
      out.push(decision(c.record, 'eligible', undefined, c.day));
    }
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
