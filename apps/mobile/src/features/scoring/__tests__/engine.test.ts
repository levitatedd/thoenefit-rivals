import { scoreCompetition, startCompetition, toPublicStandings } from '../engine';
import { RULES_V1 } from '../rules';
import type { SyncState } from '../types';
import {
  AFTER_FINAL,
  PHONE,
  WATCH,
  chicagoMidnight,
  dayTotal,
  person,
  rec,
  stepBattle,
  synced,
} from '../__testutils__/helpers';

const allSynced = (...ids: string[]): SyncState[] => ids.map((id) => synced(id));

function standing(result: ReturnType<typeof scoreCompetition>, id: string) {
  const s = result.standings.find((x) => x.participantId === id);
  if (!s) throw new Error(`no standing for ${id}`);
  return s;
}

describe('competition scoring', () => {
  it('sums individually capped daily points and stores rules version and goal snapshots', () => {
    const c = stepBattle([person('ana', 10000)]);
    const records = [dayTotal('ana', '2026-11-02', 12000), dayTotal('ana', '2026-11-03', 25000)];
    const result = scoreCompetition(c, records, allSynced('ana'), AFTER_FINAL);
    const ana = standing(result, 'ana');
    expect(ana.days.slice(0, 2).map((d) => d.points)).toEqual([120, 200]);
    expect(ana.days[1].capped).toBe(true);
    expect(ana.totalPoints).toBe(320);
    expect(result.rules.version).toBe('v1');
    expect(ana.goal).toEqual({
      metric: 'steps',
      dailyGoal: 10000,
      lockedAt: '2026-11-02T06:00:00.000Z',
    });
    expect(result.phase).toBe('final');
  });

  it('a confirmed zero day scores 0 and is distinguished from missing data', () => {
    const c = stepBattle([person('ana', 10000)]);
    const result = scoreCompetition(
      c,
      [dayTotal('ana', '2026-11-02', 0)],
      allSynced('ana'),
      AFTER_FINAL,
    );
    const day = standing(result, 'ana').days[0];
    expect(day).toEqual(
      expect.objectContaining({ status: 'confirmed', points: 0, eligibleActivity: 0 }),
    );
  });

  it('missing data is pending (not a confirmed zero) while the competition runs', () => {
    const c = stepBattle([person('ana', 10000), person('ben', 10000)]);
    const asOf = '2026-11-04T18:00:00Z'; // Wednesday afternoon
    const sync: SyncState[] = [
      { participantId: 'ana', syncedThrough: chicagoMidnight('2026-11-04'), permission: 'granted' },
      { participantId: 'ben', permission: 'granted' }, // hasn't synced at all yet
    ];
    const result = scoreCompetition(c, [dayTotal('ana', '2026-11-02', 5000)], sync, asOf);
    expect(result.phase).toBe('in-progress');
    const ana = standing(result, 'ana');
    expect(ana.days.map((d) => d.status)).toEqual([
      'confirmed', // synced, has data
      'confirmed', // synced, genuinely zero
      'pending', // today
      'future',
      'future',
      'future',
      'future',
    ]);
    expect(standing(result, 'ben').days[0].status).toBe('pending');
    expect(ana.provisional).toBe(true);
  });

  it('revoked permission is explained rather than scored as a silent zero', () => {
    const c = stepBattle([person('ana', 10000)]);
    const result = scoreCompetition(
      c,
      [],
      [{ participantId: 'ana', permission: 'revoked' }],
      AFTER_FINAL,
    );
    expect(standing(result, 'ana').days[0].status).toBe('permission-revoked');
  });

  it('late data inside the grace period updates provisional scores; after finalization it never does', () => {
    const c = stepBattle([person('ana', 10000)]);
    const sundayEnd = chicagoMidnight('2026-11-09');
    const inGrace = dayTotal('ana', '2026-11-08', 10000, { receivedAt: '2026-11-09T20:00:00Z' });
    const tooLate = dayTotal('ana', '2026-11-07', 20000, { receivedAt: '2026-11-10T07:00:00Z' });

    const beforeSync = scoreCompetition(c, [inGrace, tooLate], [], '2026-11-09T12:00:00Z');
    expect(beforeSync.phase).toBe('grace');
    expect(standing(beforeSync, 'ana').totalPoints).toBe(0); // not received yet

    const afterSync = scoreCompetition(
      c,
      [inGrace, tooLate],
      [synced('ana', sundayEnd)],
      '2026-11-09T21:00:00Z',
    );
    expect(standing(afterSync, 'ana').totalPoints).toBe(100);
    expect(standing(afterSync, 'ana').provisional).toBe(true);

    const final = scoreCompetition(c, [inGrace, tooLate], [synced('ana', sundayEnd)], AFTER_FINAL);
    expect(final.phase).toBe('final');
    expect(final.finalizesAt).toBe('2026-11-10T06:00:00.000Z');
    expect(standing(final, 'ana').totalPoints).toBe(100);
    expect(standing(final, 'ana').decisions).toEqual([
      expect.objectContaining({ recordId: tooLate.id, status: 'excluded', reason: 'LATE_SYNC' }),
    ]);
    // Recomputing much later gives exactly the same final result.
    const later = scoreCompetition(
      c,
      [inGrace, tooLate],
      [synced('ana', sundayEnd)],
      '2027-01-01T00:00:00Z',
    );
    expect(later.standings).toEqual(final.standings);
  });

  it('exact ties share a rank (1, 1, 3) and ranking uses exact centi-points', () => {
    const c = stepBattle([person('ana', 10000), person('ben', 5000), person('cy', 10000)]);
    const records = [
      dayTotal('ana', '2026-11-02', 10000),
      dayTotal('ben', '2026-11-02', 5000),
      dayTotal('cy', '2026-11-02', 9999),
    ];
    const result = scoreCompetition(c, records, allSynced('ana', 'ben', 'cy'), AFTER_FINAL);
    expect(result.standings.map((s) => [s.participantId, s.rank, s.totalCentiPoints])).toEqual([
      ['ana', 1, 10000],
      ['ben', 1, 10000],
      ['cy', 3, 9999],
    ]);
  });

  it('withdrawn participants keep earlier history, are marked, and are not ranked', () => {
    const c = stepBattle([person('ana', 10000), person('ben', 10000)]);
    const withdrawn = {
      ...c,
      participants: c.participants.map((p) =>
        p.id === 'ben' ? { ...p, withdrawnAt: chicagoMidnight('2026-11-04') } : p,
      ),
    };
    const records = [
      dayTotal('ana', '2026-11-02', 1000),
      dayTotal('ben', '2026-11-03', 9000),
      dayTotal('ben', '2026-11-05', 9000),
    ];
    const result = scoreCompetition(withdrawn, records, allSynced('ana', 'ben'), AFTER_FINAL);
    const ben = standing(result, 'ben');
    expect(ben.withdrawn).toBe(true);
    expect(ben.rank).toBeNull();
    expect(ben.totalPoints).toBe(90); // the day after withdrawal doesn't score
    expect(ben.days[3].status).toBe('withdrawn');
    expect(standing(result, 'ana').rank).toBe(1);
  });

  it('rejects late entry: participants must join before the start', () => {
    expect(() => stepBattle([person('ana', 10000, { joinedAt: '2026-11-03T12:00:00Z' })])).toThrow(
      'late entry',
    );
  });

  it('a locked goal is unaffected by later profile edits', () => {
    const profile = {
      id: 'ana',
      displayName: 'Ana',
      joinedAt: '2026-11-01T00:00:00Z',
      profileGoal: 8000,
    };
    const c = stepBattle([profile]);
    profile.profileGoal = 2000;
    const result = scoreCompetition(
      c,
      [dayTotal('ana', '2026-11-02', 8000)],
      allSynced('ana'),
      AFTER_FINAL,
    );
    expect(standing(result, 'ana').goal.dailyGoal).toBe(8000);
    expect(standing(result, 'ana').days[0].points).toBe(100);
  });

  it('assigns activity at the competition boundaries and across DST to the right day', () => {
    // Daylight saving ends in Chicago on Sun 1 Nov 2026; this competition runs 1–2 Nov.
    const c = startCompetition({
      id: 'dst',
      categoryId: 'step-battle',
      timeZone: 'America/Chicago',
      startDate: '2026-11-01',
      endDate: '2026-11-02',
      participants: [person('ana', 1000, { joinedAt: '2026-10-31T00:00:00Z' })],
    });
    const sample = (start: string, value: number) =>
      rec({
        participantId: 'ana',
        type: 'sample',
        start,
        end: start,
        value,
        receivedAt: '2026-11-03T12:00:00Z',
      });
    const records = [
      sample('2026-11-01T04:59:59Z', 111), // 23:59:59 CDT on 31 Oct: before the start
      sample('2026-11-01T05:00:00Z', 100), // 00:00 CDT on 1 Nov: first instant, included
      sample('2026-11-02T05:30:00Z', 200), // 23:30 CST on 1 Nov (25-hour day)
      sample('2026-11-02T06:00:00Z', 300), // 00:00 CST on 2 Nov
      sample('2026-11-03T06:00:00Z', 999), // 00:00 on 3 Nov: end is exclusive
    ];
    const result = scoreCompetition(
      c,
      records,
      [synced('ana', '2026-11-03T06:00:00Z')],
      AFTER_FINAL,
    );
    const ana = standing(result, 'ana');
    expect(ana.days.map((d) => [d.date, d.eligibleActivity])).toEqual([
      ['2026-11-01', 300],
      ['2026-11-02', 300],
    ]);
    expect(
      ana.decisions.filter((d) => d.reason === 'OUTSIDE_COMPETITION').map((d) => d.recordId),
    ).toEqual([records[0].id, records[4].id]);
  });
});

describe('eligibility in scoring', () => {
  const c = () => stepBattle([person('ana', 10000)]);
  const day = '2026-11-02';
  const sample = (start: string, end: string, value: number, extra = {}) =>
    rec({ participantId: 'ana', type: 'sample', start, end, value, ...extra });

  it('excludes duplicates and manual entries, accepts identifiable imports, holds ambiguous records', () => {
    const a = sample('2026-11-02T14:00:00Z', '2026-11-02T15:00:00Z', 3000);
    const records = [
      a,
      { ...a }, // same id synced twice
      sample('2026-11-02T16:00:00Z', '2026-11-02T17:00:00Z', 5000, {
        source: { ...PHONE, recordingMethod: 'manual' },
      }),
      sample('2026-11-02T18:00:00Z', '2026-11-02T19:00:00Z', 2000, {
        source: {
          kind: 'third-party-import',
          platform: 'health-connect',
          recordingMethod: 'automatic',
          appId: 'com.garmin.connect',
        },
      }),
      sample('2026-11-02T20:00:00Z', '2026-11-02T21:00:00Z', 4000, {
        source: { kind: 'unknown', platform: 'health-connect', recordingMethod: 'unknown' },
      }),
    ];
    const result = scoreCompetition(c(), records, allSynced('ana'), AFTER_FINAL);
    const ana = standing(result, 'ana');
    expect(ana.days[0].eligibleActivity).toBe(5000); // 3000 watch + 2000 import
    expect(ana.days[0].heldRecordIds).toEqual([records[4].id]); // held, but the rest still counts
    expect(ana.decisions.map((d) => [d.status, d.reason])).toEqual(
      expect.arrayContaining([
        ['excluded', 'DUPLICATE_ACTIVITY'],
        ['excluded', 'MANUAL_ENTRY'],
        ['held', 'UNKNOWN_SOURCE'],
      ]),
    );
    expect(
      ana.decisions.every((d) => typeof d.explanation === 'string' && d.explanation.length > 0),
    ).toBe(true);
  });

  it('holds third-party imports without provenance', () => {
    const r = sample('2026-11-02T18:00:00Z', '2026-11-02T19:00:00Z', 2000, {
      source: {
        kind: 'third-party-import',
        platform: 'health-connect',
        recordingMethod: 'automatic',
      },
    });
    const ana = standing(scoreCompetition(c(), [r], allSynced('ana'), AFTER_FINAL), 'ana');
    expect(ana.days[0].heldRecordIds).toEqual([r.id]);
    expect(ana.days[0].eligibleActivity).toBe(0);
  });

  it('never adds workout active energy on top of daily active energy', () => {
    const clash = stepBattle([person('ana', 500)], 'calorie-clash');
    const records = [
      rec({
        participantId: 'ana',
        metric: 'activeEnergyKcal',
        value: 600,
        start: chicagoMidnight(day),
        end: chicagoMidnight('2026-11-03'),
      }),
      rec({
        participantId: 'ana',
        metric: 'activeEnergyKcal',
        type: 'workout',
        value: 350,
        start: '2026-11-02T13:00:00Z',
        end: '2026-11-02T14:00:00Z',
      }),
    ];
    const ana = standing(scoreCompetition(clash, records, allSynced('ana'), AFTER_FINAL), 'ana');
    expect(ana.days[0].eligibleActivity).toBe(600);
    expect(ana.days[0].points).toBe(120);
    expect(ana.decisions[0]).toEqual(expect.objectContaining({ reason: 'DUPLICATE_ACTIVITY' }));
  });

  it('does not score steps in a Calorie Clash (one metric per competition)', () => {
    const clash = stepBattle([person('ana', 500)], 'calorie-clash');
    const ana = standing(
      scoreCompetition(clash, [dayTotal('ana', day, 9000)], allSynced('ana'), AFTER_FINAL),
      'ana',
    );
    expect(ana.totalPoints).toBe(0);
    expect(ana.decisions[0].reason).toBe('UNSUPPORTED_METRIC');
  });

  it('prefers the platform daily total over individual samples', () => {
    const records = [
      dayTotal('ana', day, 9000),
      sample('2026-11-02T14:00:00Z', '2026-11-02T15:00:00Z', 3000),
    ];
    const ana = standing(scoreCompetition(c(), records, allSynced('ana'), AFTER_FINAL), 'ana');
    expect(ana.days[0].eligibleActivity).toBe(9000);
  });

  describe('duplicates need evidence; overlap alone holds instead of excluding', () => {
    const IMPORT = {
      kind: 'third-party-import' as const,
      platform: 'healthkit' as const,
      recordingMethod: 'automatic' as const,
      appId: 'com.garmin.connect',
    };

    it('(a) confirmed duplicates: one activity via watch, phone and an import is counted once', () => {
      const watch = sample('2026-11-02T14:00:00Z', '2026-11-02T15:00:00Z', 3000, {
        source: WATCH,
        activityId: 'walk-1',
      });
      const phone = sample('2026-11-02T14:02:00Z', '2026-11-02T14:58:00Z', 2900, {
        source: PHONE,
        activityId: 'walk-1',
      });
      const imported = sample('2026-11-02T14:00:00Z', '2026-11-02T15:00:00Z', 3010, {
        source: IMPORT,
        activityId: 'walk-1',
      });
      const ana = standing(
        scoreCompetition(c(), [phone, imported, watch], allSynced('ana'), AFTER_FINAL),
        'ana',
      );
      expect(ana.days[0].eligibleActivity).toBe(3000); // the watch copy (highest priority)
      expect(ana.days[0].heldRecordIds).toEqual([]);
      expect(ana.decisions.map((d) => [d.recordId, d.status, d.reason]).sort()).toEqual(
        [
          [phone.id, 'excluded', 'DUPLICATE_ACTIVITY'],
          [imported.id, 'excluded', 'DUPLICATE_ACTIVITY'],
        ].sort(),
      );
    });

    it('(a) a platform-deduplicated daily total covers every source that day', () => {
      const total = dayTotal('ana', day, 9000);
      const watch = sample('2026-11-02T14:00:00Z', '2026-11-02T15:00:00Z', 3000, { source: WATCH });
      const phone = sample('2026-11-02T14:00:00Z', '2026-11-02T15:00:00Z', 2800, { source: PHONE });
      const ana = standing(
        scoreCompetition(c(), [watch, phone, total], allSynced('ana'), AFTER_FINAL),
        'ana',
      );
      expect(ana.days[0].eligibleActivity).toBe(9000);
      expect(ana.decisions.every((d) => d.reason === 'DUPLICATE_ACTIVITY')).toBe(true);
    });

    it('(b) distinct activity with overlapping timestamps is held, not excluded, and unrelated activity counts', () => {
      // A watch-tracked run and a phone-tracked walk with a partner overlap in time; nothing says
      // they are the same activity.
      const run = sample('2026-11-02T14:00:00Z', '2026-11-02T15:00:00Z', 6000, {
        source: WATCH,
        activityId: 'run-7',
      });
      const walk = sample('2026-11-02T14:30:00Z', '2026-11-02T15:30:00Z', 2500, {
        source: PHONE,
        activityId: 'walk-9',
      });
      const evening = sample('2026-11-02T23:00:00Z', '2026-11-02T23:30:00Z', 1000, {
        source: PHONE,
      });
      const ana = standing(
        scoreCompetition(c(), [walk, run, evening], allSynced('ana'), AFTER_FINAL),
        'ana',
      );
      expect(ana.days[0].eligibleActivity).toBe(7000); // run + unrelated evening walk
      expect(ana.days[0].heldRecordIds).toEqual([walk.id]);
      expect(ana.decisions).toEqual([
        expect.objectContaining({
          recordId: walk.id,
          status: 'held',
          reason: 'OVERLAP_UNRESOLVED',
        }),
      ]);
      expect(ana.decisions[0].explanation).toMatch(
        /might be the same activity.*other activity still counts/,
      );
    });

    it('(b) without identifiers, overlapping watch and phone samples hold the phone contribution', () => {
      const watch = sample('2026-11-02T14:00:00Z', '2026-11-02T15:00:00Z', 3000, { source: WATCH });
      const phone = sample('2026-11-02T14:10:00Z', '2026-11-02T14:50:00Z', 2800, { source: PHONE });
      const laterPhone = sample('2026-11-02T18:00:00Z', '2026-11-02T19:00:00Z', 1000, {
        source: PHONE,
      });
      const ana = standing(
        scoreCompetition(c(), [phone, watch, laterPhone], allSynced('ana'), AFTER_FINAL),
        'ana',
      );
      expect(ana.days[0].eligibleActivity).toBe(4000); // never phone + watch blindly summed
      expect(ana.decisions).toEqual([
        expect.objectContaining({
          recordId: phone.id,
          status: 'held',
          reason: 'OVERLAP_UNRESOLVED',
        }),
      ]);
    });

    it('overlap within one source is not duplication; equal-priority sources keep one and hold the other', () => {
      const sameA = sample('2026-11-02T14:00:00Z', '2026-11-02T15:00:00Z', 1000, { source: WATCH });
      const sameB = sample('2026-11-02T14:30:00Z', '2026-11-02T15:30:00Z', 1500, { source: WATCH });
      const phone1 = sample('2026-11-02T20:00:00Z', '2026-11-02T21:00:00Z', 700, { source: PHONE });
      const phone2 = sample('2026-11-02T20:30:00Z', '2026-11-02T21:30:00Z', 900, {
        source: { ...PHONE, deviceId: 'other-phone' },
      });
      const ana = standing(
        scoreCompetition(c(), [phone2, sameA, sameB, phone1], allSynced('ana'), AFTER_FINAL),
        'ana',
      );
      expect(ana.days[0].eligibleActivity).toBe(3200); // both watch samples + the earlier phone sample
      expect(ana.days[0].heldRecordIds).toEqual([phone2.id]);
    });

    it('does not assume every daily total is de-duplicated: a single-source total gets no precedence', () => {
      const phoneTotal = dayTotal('ana', day, 7000, {
        source: PHONE,
        aggregation: 'single-source',
      });
      const watch = sample('2026-11-02T14:00:00Z', '2026-11-02T15:00:00Z', 3000, { source: WATCH });
      const ana = standing(
        scoreCompetition(c(), [phoneTotal, watch], allSynced('ana'), AFTER_FINAL),
        'ana',
      );
      // The phone's own all-day total overlaps the watch sample and may include the same steps.
      expect(ana.days[0].eligibleActivity).toBe(3000);
      expect(ana.days[0].heldRecordIds).toEqual([phoneTotal.id]);
      // A total with no aggregation claim is treated the same way.
      const unknownTotal = dayTotal('ana', day, 7000, { source: PHONE, aggregation: undefined });
      const again = standing(
        scoreCompetition(c(), [unknownTotal, watch], allSynced('ana'), AFTER_FINAL),
        'ana',
      );
      expect(again.days[0].heldRecordIds).toEqual([unknownTotal.id]);
    });
  });

  describe('records crossing a competition-day boundary (v1 limitation)', () => {
    it('holds a sample spanning local midnight instead of guessing a split; other activity counts', () => {
      // Chicago local: 23:30 on Mon 2 Nov → 00:30 on Tue 3 Nov.
      const spanning = sample('2026-11-03T05:30:00Z', '2026-11-03T06:30:00Z', 1200);
      const monday = sample('2026-11-02T18:00:00Z', '2026-11-02T19:00:00Z', 4000);
      const endsAtMidnight = sample('2026-11-03T05:00:00Z', '2026-11-03T06:00:00Z', 800); // half-open: OK
      const ana = standing(
        scoreCompetition(c(), [spanning, monday, endsAtMidnight], allSynced('ana'), AFTER_FINAL),
        'ana',
      );
      expect(ana.days[0].eligibleActivity).toBe(4800);
      expect(ana.days[1].eligibleActivity).toBe(0);
      expect(ana.days[0].heldRecordIds).toEqual([spanning.id]);
      expect(ana.decisions).toEqual([
        expect.objectContaining({
          recordId: spanning.id,
          status: 'held',
          reason: 'SPANS_DAY_BOUNDARY',
        }),
      ]);
    });

    it('holds records crossing the competition start or end, and excludes records fully outside', () => {
      const crossesStart = sample('2026-11-02T05:00:00Z', '2026-11-02T07:00:00Z', 900); // 23:00 Sun → 01:00 Mon
      const crossesEnd = sample('2026-11-09T05:00:00Z', '2026-11-09T07:00:00Z', 900); // 23:00 Sun 8 → 01:00 Mon 9
      const before = sample('2026-11-02T04:00:00Z', '2026-11-02T06:00:00Z', 500); // ends exactly at the start
      const after = sample('2026-11-09T06:00:00Z', '2026-11-09T07:00:00Z', 500); // starts exactly at the end
      const result = scoreCompetition(
        c(),
        [crossesStart, crossesEnd, before, after],
        allSynced('ana'),
        AFTER_FINAL,
      );
      const ana = standing(result, 'ana');
      expect(ana.totalPoints).toBe(0);
      expect(ana.days[0].heldRecordIds).toEqual([crossesStart.id]);
      expect(ana.days[6].heldRecordIds).toEqual([crossesEnd.id]);
      const reasons = Object.fromEntries(ana.decisions.map((d) => [d.recordId, d.reason]));
      expect(reasons).toEqual({
        [crossesStart.id]: 'SPANS_DAY_BOUNDARY',
        [crossesEnd.id]: 'SPANS_DAY_BOUNDARY',
        [before.id]: 'OUTSIDE_COMPETITION',
        [after.id]: 'OUTSIDE_COMPETITION',
      });
    });
  });

  it('rejects malformed records safely', () => {
    const records = [
      sample('2026-11-02T14:00:00Z', '2026-11-02T15:00:00Z', -5),
      sample('2026-11-02T14:00:00Z', '2026-11-02T15:00:00Z', Number.NaN),
      sample('2026-11-02T15:00:00Z', '2026-11-02T14:00:00Z', 100), // ends before it starts
      sample('not a date', '2026-11-02T14:00:00Z', 100),
      rec({ participantId: 'stranger', value: 100 }),
    ];
    const result = scoreCompetition(c(), records, allSynced('ana'), AFTER_FINAL);
    expect(standing(result, 'ana').totalPoints).toBe(0);
    expect(standing(result, 'ana').decisions).toHaveLength(4);
    expect(standing(result, 'ana').decisions.every((d) => d.reason === 'INVALID_RECORD')).toBe(
      true,
    );
  });
});

describe('privacy', () => {
  it('the public leaderboard shows goals and scores, not records or private advice', () => {
    const c = stepBattle([
      person('ana', 10000, { history: [{ date: '2026-10-30', value: 9000 }] }),
    ]);
    const result = scoreCompetition(
      c,
      [dayTotal('ana', '2026-11-02', 12000)],
      allSynced('ana'),
      AFTER_FINAL,
    );
    const [pub] = toPublicStandings(result);
    expect(pub).toEqual(
      expect.objectContaining({
        participantId: 'ana',
        dailyGoal: 10000,
        totalPoints: 120,
        rank: 1,
      }),
    );
    expect(Object.keys(pub)).not.toEqual(
      expect.arrayContaining(['decisions', 'fairnessAtStart', 'goalSuggestion']),
    );
    expect(JSON.stringify(pub)).not.toMatch(/eligibleActivity|heldRecordIds|9000/);
  });

  it('uses the v1 rules by default', () => {
    expect(stepBattle([person('ana', 1)]).rules).toBe(RULES_V1);
  });
});
