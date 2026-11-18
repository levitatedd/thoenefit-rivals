import { scoreCompetition } from '../engine';
import {
  assessGoal,
  capSuggestionThreshold,
  computeBaseline,
  suggestFutureGoal,
} from '../fairness';
import { RULES_V1 } from '../rules';
import { addDays } from '../time';
import type { DailyScore, HistoryDay } from '../types';
import { AFTER_FINAL, dayTotal, person, stepBattle, synced } from '../__testutils__/helpers';

const F = RULES_V1.fairness;

/** `n` consecutive days ending 2026-10-31 with the given value (null = missing). */
function history(n: number, value: number | null, end = '2026-10-31'): HistoryDay[] {
  return Array.from({ length: n }, (_, i) => ({ date: addDays(end, -i), value }));
}

describe('goal baseline', () => {
  it('is the median of the last 28 calendar days, counting zero days but not missing days', () => {
    const days: HistoryDay[] = [
      ...history(10, 10000),
      ...history(4, 0, '2026-10-21'), // genuine rest days count
      ...history(14, null, '2026-10-17'), // missing data does not count as zero
      ...history(5, 99999, '2026-10-03'), // older than 28 days: ignored
    ];
    const b = computeBaseline(days, F);
    expect(b.validDays).toBe(14);
    expect(b.baseline).toBe(10000);
    expect(b.sufficiency).toBe('normal');
  });

  it('uses 14+ valid days as normal, 7–13 as provisional, under 7 as insufficient', () => {
    expect(computeBaseline(history(14, 5000), F).sufficiency).toBe('normal');
    expect(computeBaseline(history(13, 5000), F).sufficiency).toBe('provisional');
    expect(computeBaseline(history(7, 5000), F).sufficiency).toBe('provisional');
    expect(computeBaseline(history(6, 5000), F).sufficiency).toBe('insufficient');
  });
});

describe('goal fairness advisory', () => {
  const h = history(20, 10000);
  it.each([
    [5999, 'potentially-easy'],
    [6000, 'below-usual'], // 60% is the first "below usual" value
    [7999, 'below-usual'],
    [8000, 'near-usual'], // 80–120% inclusive is "near usual"
    [12000, 'near-usual'],
    [12001, 'above-usual'],
  ])('goal %p against a 10,000 baseline is %p', (goal, band) => {
    expect(assessGoal(goal, h, F).band).toBe(band);
  });

  it('handles zero baseline, insufficient history and missing permission explicitly', () => {
    expect(assessGoal(5000, history(20, 0), F).band).toBe('zero-baseline');
    expect(assessGoal(5000, history(6, 10000), F).band).toBe('insufficient-history');
    expect(assessGoal(5000, history(20, 10000), F, 'revoked').band).toBe('unavailable');
  });

  it('marks provisional advice and words messages neutrally', () => {
    const a = assessGoal(3000, history(10, 10000), F);
    expect(a.band).toBe('potentially-easy');
    expect(a.message).toMatch(/rough guide/);
    expect(a.message).toMatch(/You can keep it/);
  });

  it('is snapshotted at start and never changes points (warn, never penalize)', () => {
    const easy = stepBattle([person('ana', 2000, { history: history(20, 10000) })]);
    const fair = stepBattle([person('ana', 2000)]);
    expect(easy.participants[0].fairnessAtStart?.band).toBe('potentially-easy');
    const records = [dayTotal('ana', '2026-11-02', 4000)];
    const a = scoreCompetition(easy, records, [synced('ana')], AFTER_FINAL).standings[0];
    const b = scoreCompetition(fair, records, [synced('ana')], AFTER_FINAL).standings[0];
    expect(a.totalCentiPoints).toBe(b.totalCentiPoints);
    expect(a.goal.dailyGoal).toBe(2000); // not auto-adjusted
    expect(a.fairnessAtStart).toEqual(easy.participants[0].fairnessAtStart);
  });
});

describe('future goal suggestion after repeated capped days', () => {
  const capped = (n: number, total = 7): DailyScore[] =>
    Array.from({ length: total }, (_, i) => ({
      date: addDays('2026-11-02', i),
      status: 'confirmed' as const,
      eligibleActivity: 0,
      centiPoints: i < n ? 20000 : 5000,
      points: i < n ? 200 : 50,
      capped: i < n,
      heldRecordIds: [],
    }));

  it('triggers at 3 capped days in a 7-day competition, not at 2', () => {
    expect(capSuggestionThreshold(7, RULES_V1)).toBe(3);
    expect(suggestFutureGoal(capped(2), 7, 10000, 'steps', RULES_V1)).toBeUndefined();
    const s = suggestFutureGoal(capped(3), 7, 10000, 'steps', RULES_V1);
    expect(s).toEqual(
      expect.objectContaining({
        cappedDays: 3,
        suggestedGoal: 11000,
        appliesTo: 'future-competitions',
      }),
    );
  });

  it('uses a configurable policy for other durations', () => {
    expect(capSuggestionThreshold(3, RULES_V1)).toBe(2); // minimum
    expect(capSuggestionThreshold(14, RULES_V1)).toBe(6);
    expect(capSuggestionThreshold(30, RULES_V1)).toBe(13);
  });

  it('rounds suggestions to friendly numbers per metric', () => {
    expect(suggestFutureGoal(capped(3), 7, 8333, 'steps', RULES_V1)?.suggestedGoal).toBe(9200);
    expect(suggestFutureGoal(capped(3), 7, 455, 'activeEnergyKcal', RULES_V1)?.suggestedGoal).toBe(
      510,
    );
  });

  it('appears once per competition result, privately, and never alters goals or scores', () => {
    const c = stepBattle([person('ana', 10000), person('ben', 10000)]);
    const records = ['2026-11-02', '2026-11-03', '2026-11-04'].flatMap((d) => [
      dayTotal('ana', d, 30000),
      dayTotal('ben', d, 30000),
    ]);
    const result = scoreCompetition(c, records, [synced('ana'), synced('ben')], AFTER_FINAL);
    const ana = result.standings.find((s) => s.participantId === 'ana')!;
    expect(ana.goalSuggestion?.suggestedGoal).toBe(11000);
    expect(ana.goal.dailyGoal).toBe(10000);
    expect(ana.totalPoints).toBe(600);
    expect(result.standings.filter((s) => s.goalSuggestion)).toHaveLength(2); // one each, not per day
  });
});
