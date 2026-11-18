import {
  scoreCompetition,
  startCompetition,
  toPublicStandings,
  type NewParticipant,
} from '../engine';
import { checkGoalForMode, publicGoalLabel, usualDayGoal } from '../goals';
import { RULES_V1 } from '../rules';
import { addDays } from '../time';
import type { GoalMode, HistoryDay } from '../types';
import { AFTER_FINAL, dayTotal, person, synced } from '../__testutils__/helpers';

/** `n` consecutive days ending 2026-10-31 with the given value (null = missing). */
function history(n: number, value: number | null): HistoryDay[] {
  return Array.from({ length: n }, (_, i) => ({ date: addDays('2026-10-31', -i), value }));
}

function competition(participants: NewParticipant[], goalMode?: GoalMode) {
  return startCompetition({
    id: 'c1',
    categoryId: 'step-battle',
    timeZone: 'America/Chicago',
    startDate: '2026-11-02',
    endDate: '2026-11-08',
    participants,
    goalMode,
  });
}

describe('usual-day goal (#32)', () => {
  it('is the 28-day median rounded to 100 steps / 10 kcal, with reliable history only', () => {
    expect(usualDayGoal(history(20, 8149), 'steps', RULES_V1)).toEqual({
      goal: 8100,
      reliable: true,
      validDays: 20,
    });
    expect(usualDayGoal(history(20, 8150), 'steps', RULES_V1).goal).toBe(8200);
    expect(usualDayGoal(history(20, 444), 'activeEnergyKcal', RULES_V1).goal).toBe(440);
  });

  it('needs 14+ valid days; missing days are not counted as zero', () => {
    expect(usualDayGoal(history(14, 9000), 'steps', RULES_V1).reliable).toBe(true);
    expect(usualDayGoal(history(13, 9000), 'steps', RULES_V1)).toEqual({
      goal: null,
      reliable: false,
      validDays: 13,
    });
    const gappy = [...history(14, 9000), ...history(28, null)];
    expect(usualDayGoal(gappy, 'steps', RULES_V1).goal).toBe(9000);
  });

  it('is unavailable without permission or with a zero median', () => {
    expect(usualDayGoal(history(20, 9000), 'steps', RULES_V1, 'revoked').reliable).toBe(false);
    expect(usualDayGoal(history(20, 0), 'steps', RULES_V1).reliable).toBe(false);
  });
});

describe('goal checks by mode', () => {
  const reliable = { goal: 8000, reliable: true, validDays: 20 };
  const limited = { goal: null, reliable: false, validDays: 5 };

  it('usual-day mode: the usual day or higher; never lower', () => {
    expect(checkGoalForMode('usual-day', 8000, reliable)).toEqual({ ok: true, basis: 'usual-day' });
    expect(checkGoalForMode('usual-day', 9000, reliable)).toEqual({ ok: true, basis: 'raised' });
    const lower = checkGoalForMode('usual-day', 7900, reliable);
    expect(lower).toEqual(expect.objectContaining({ ok: false, minimum: 8000 }));
  });

  it('limited history: any goal, in either mode', () => {
    expect(checkGoalForMode('usual-day', 1000, limited)).toEqual({
      ok: true,
      basis: 'limited-history',
    });
    expect(checkGoalForMode('choose-own', 1000, limited).ok).toBe(true);
  });

  it('casual mode: any goal', () => {
    expect(checkGoalForMode('choose-own', 2000, reliable)).toEqual({
      ok: true,
      basis: 'own-choice',
    });
  });
});

describe('competitions with goal modes', () => {
  const regular = history(20, 10000); // usual day 10,000

  it('defaults to choose-own (v1 behaviour) and records the mode', () => {
    const c = competition([person('ana', 3000, { history: regular })]);
    expect(c.goalMode).toBe('choose-own');
    expect(c.participants[0]).toEqual(
      expect.objectContaining({ goalBasis: 'own-choice', usualDayGoal: 10000 }),
    );
  });

  it('usual-day mode rejects a goal below a reliable usual day', () => {
    expect(() => competition([person('ana', 9900, { history: regular })], 'usual-day')).toThrow(
      /can be raised but not set below your usual day \(10000\)/,
    );
  });

  it('usual-day mode accepts the usual day or a raised goal, and limited history picks freely', () => {
    const c = competition(
      [
        person('ana', 10000, { history: regular }),
        person('ben', 12000, { history: regular }),
        person('cat', 2000, { history: history(6, 10000) }), // new to tracking
        person('dan', 2000, { history: regular, permission: 'revoked' }),
      ],
      'usual-day',
    );
    expect(c.participants.map((p) => p.goalBasis)).toEqual([
      'usual-day',
      'raised',
      'limited-history',
      'limited-history',
    ]);
  });

  it('never changes points: the same goal scores the same in both modes', () => {
    const records = [dayTotal('ana', '2026-11-02', 12000)];
    const score = (mode: GoalMode) =>
      scoreCompetition(
        competition([person('ana', 10000, { history: regular })], mode),
        records,
        [synced('ana')],
        AFTER_FINAL,
      ).standings[0].totalCentiPoints;
    expect(score('usual-day')).toBe(score('choose-own'));
    expect(score('usual-day')).toBe(12000);
  });

  it('public standings carry a neutral goal label but no history or usual-day numbers', () => {
    const c = competition(
      [
        person('ana', 10000, { history: regular }),
        person('ben', 5000, { history: regular }), // 50% of usual: privately "potentially easy"
        person('cat', 2000, { history: history(10, 10000) }), // provisional history
      ],
      'choose-own',
    );
    const result = scoreCompetition(
      c,
      [],
      [synced('ana'), synced('ben'), synced('cat')],
      AFTER_FINAL,
    );
    const labels = Object.fromEntries(
      toPublicStandings(result).map((s) => [s.participantId, s.goalLabel]),
    );
    expect(labels).toEqual({ ana: 'near-usual', ben: 'below-usual', cat: 'limited-history' });
    const ben = toPublicStandings(result).find((s) => s.participantId === 'ben')!;
    expect(Object.keys(ben)).not.toEqual(
      expect.arrayContaining(['usualDayGoal', 'fairnessAtStart', 'decisions', 'goalBasis']),
    );
    expect(JSON.stringify(ben)).not.toMatch(/potentially|baseline|10000/);
  });
});

describe('public goal label', () => {
  it('never labels limited history as below usual', () => {
    expect(publicGoalLabel('choose-own', 'limited-history', undefined)).toBe('limited-history');
    expect(publicGoalLabel('usual-day', 'limited-history', undefined)).toBe('limited-history');
  });

  it('usual-day mode shows "usual day" or "above usual" for raised goals', () => {
    expect(publicGoalLabel('usual-day', 'usual-day', undefined)).toBe('usual-day');
    expect(publicGoalLabel('usual-day', 'raised', undefined)).toBe('above-usual');
  });
});
