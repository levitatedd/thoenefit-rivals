import { RULES_V1 } from '../../rules';
import {
  capAndComebackExample,
  DURATIONS,
  goalAmbition,
  missedDays,
  mixedFitness,
  rawTotalsBaseline,
  tieRate,
} from '../scenarios';
import { simulateCompetition, statsOf, type ScenarioSpec } from '../simulate';

/**
 * Validation of the v1 scoring rules (#14) with synthetic, seeded simulations. Fewer runs than
 * the published report (docs/SCORING-VALIDATION.md), so tolerances are deliberately wide: these
 * tests guard the qualitative findings and the engine invariants, not exact percentages.
 */
const RUNS = 120;
const CAP = RULES_V1.dailyCapPoints;

describe('engine invariants across simulated competitions', () => {
  it.each(
    DURATIONS.flatMap((days) =>
      (['step-battle', 'calorie-clash'] as const).map((c) => [c, days] as const),
    ),
  )(
    '%s, %p day(s): days ≤ 200 points, totals are sums of days, ranks are consistent',
    (categoryId, days) => {
      for (let run = 0; run < 25; run++) {
        const { result } = simulateCompetition({
          categoryId,
          days,
          seed: `invariants-${categoryId}-${days}-${run}`,
          players: [
            {
              id: 'easy',
              profile: 'moderate',
              goalFactor: 0.4,
              exceptionalDays: [{ day: 0, factor: 4 }],
            },
            { id: 'honest', profile: 'active', goalFactor: 1, missedDays: [days - 1] },
            { id: 'ambitious', profile: 'athlete', goalFactor: 1.5 },
          ],
        });
        for (const s of result.standings) {
          expect(s.days).toHaveLength(days);
          for (const d of s.days) {
            expect(d.points).toBeGreaterThanOrEqual(0);
            expect(d.points).toBeLessThanOrEqual(CAP);
            expect(d.status).toBe('confirmed');
          }
          expect(s.totalCentiPoints).toBe(s.days.reduce((sum, d) => sum + d.centiPoints, 0));
          expect(s.totalPoints).toBeLessThanOrEqual(CAP * days);
        }
        const ranked = [...result.standings].sort(
          (a, b) => b.totalCentiPoints - a.totalCentiPoints,
        );
        ranked.forEach((s, i) => {
          if (i > 0 && s.totalCentiPoints === ranked[i - 1].totalCentiPoints)
            expect(s.rank).toBe(ranked[i - 1].rank);
          else expect(s.rank).toBe(i + 1);
        });
        expect(result.rules.version).toBe('v1');
      }
    },
  );

  it('is deterministic: the same seed gives identical results', () => {
    const spec: ScenarioSpec = {
      categoryId: 'step-battle',
      days: 7,
      seed: 'determinism',
      players: [
        { id: 'a', profile: 'light', goalFactor: 1 },
        { id: 'b', profile: 'athlete', goalFactor: 0.8 },
      ],
    };
    expect(simulateCompetition(spec).result).toEqual(simulateCompetition(spec).result);
  });
});

describe('personal goals level different fitness levels', () => {
  it('with honest goals, light to athlete each win a fair share of 7-day competitions', () => {
    const mc = mixedFitness(7, 'step-battle', RUNS);
    for (const p of mc.players) {
      expect(p.winShare).toBeGreaterThan(0.12);
      expect(p.winShare).toBeLessThan(0.4);
    }
  });

  it('the same holds for Calorie Clash', () => {
    const mc = mixedFitness(7, 'calorie-clash', RUNS);
    for (const p of mc.players) expect(p.winShare).toBeGreaterThan(0.12);
  });

  it('whereas ranking by raw activity would let the athlete win almost always', () => {
    expect(statsOf(rawTotalsBaseline(7, RUNS), 'athlete').winShare).toBeGreaterThan(0.85);
  });
});

describe('goal ambition (fairness warnings are advisory only)', () => {
  it('an easy goal (50% of a typical day) dominates and is flagged as potentially easy', () => {
    const tested = statsOf(goalAmbition(0.5, 7, RUNS), 'tested');
    expect(tested.winShare).toBeGreaterThan(0.9);
    expect(tested.fairnessBands['potentially-easy']).toBeGreaterThan(0.85);
    expect(tested.cappedDayShare).toBeGreaterThan(0.3); // the cap limits, but doesn't neutralise, the advantage
    expect(tested.suggestionRate).toBeGreaterThan(0.4); // private future-goal suggestions fire
  });

  it('a modestly easy goal (85%) wins well above a fair share and is now flagged below usual (#31)', () => {
    const tested = statsOf(goalAmbition(0.85, 7, RUNS), 'tested');
    expect(tested.fairnessBands['below-usual']).toBeGreaterThan(0.4); // ~57%: 85% sits near the 90% line once baseline noise is included
    expect(tested.winShare).toBeGreaterThan(0.5);
  });

  it('an honest goal is still labelled near usual with the narrower band', () => {
    expect(statsOf(goalAmbition(1, 7, RUNS), 'tested').fairnessBands['near-usual']).toBeGreaterThan(
      0.6,
    );
  });

  it('an honest goal wins about a fair share; an ambitious goal (130%) rarely wins', () => {
    const honestShare = statsOf(goalAmbition(1, 7, RUNS), 'tested').winShare;
    expect(honestShare).toBeGreaterThan(0.12);
    expect(honestShare).toBeLessThan(0.4);
    expect(statsOf(goalAmbition(1.3, 7, RUNS), 'tested').winShare).toBeLessThan(0.15);
  });
});

describe('missed days and comeback potential', () => {
  it('missing one day of seven hurts, and one exceptional day can make up for it', () => {
    const missed = statsOf(missedDays(7, 1, undefined, RUNS), 'tested').winShare;
    const withBigDay = statsOf(missedDays(7, 1, 3, RUNS), 'tested').winShare;
    expect(missed).toBeLessThan(0.15);
    expect(withBigDay).toBeGreaterThan(missed + 0.1);
  });

  it('worked example: the daily cap rewards a comeback but stops one outlier day deciding everything', () => {
    const { steady, comeback, spike } = capAndComebackExample();
    expect(steady.totalPoints).toBe(840); // 7 × 120
    expect(comeback.totalPoints).toBe(870); // 0 + 0 + 200 + 200 + 200 + 150 + 120
    expect(spike.totalPoints).toBe(560); // 6 × 60 + 200 (60,000 steps would be 600 uncapped)
    expect(spike.days[2].capped).toBe(true);
    expect([comeback.rank, steady.rank, spike.rank]).toEqual([1, 2, 3]);
  });
});

describe('ties', () => {
  it('honest goals almost never share first place (0.01-point precision)', () => {
    expect(tieRate(7, 1, RUNS).firstPlaceTieRate).toBeLessThan(0.05);
    expect(tieRate(1, 1, RUNS).firstPlaceTieRate).toBeLessThan(0.05);
  });

  it('very easy goals in a 1-day competition usually tie at the daily cap', () => {
    expect(tieRate(1, 0.4, RUNS).firstPlaceTieRate).toBeGreaterThan(0.7);
  });
});
