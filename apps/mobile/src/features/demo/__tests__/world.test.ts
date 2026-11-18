import { RULES_V1, toPublicStandings } from '@/features/scoring';

import {
  buildDemoWorld,
  demoReducer,
  initialDemoState,
  standingFor,
  type DemoState,
  type DemoWorld,
} from '..';

const TZ = 'America/Chicago';
// Wed Nov 18 2026, 12:00 in Chicago.
const NOW = Date.UTC(2026, 10, 18, 18, 0);

function world(state: DemoState = initialDemoState('2026-11-18'), now = NOW): DemoWorld {
  return buildDemoWorld(state, now, TZ);
}

function comp(w: DemoWorld, id: 'step-battle' | 'calorie-clash') {
  const c = w.competitions.find((x) => x.categoryId === id);
  if (!c) throw new Error(id);
  return c;
}

function apply(state: DemoState, ...actions: Parameters<typeof demoReducer>[1][]): DemoState {
  return actions.reduce(demoReducer, state);
}

describe('demo world (simulated data, real scoring engine)', () => {
  it('starts with a live 7-day Step Battle on day 3 and a final 3-day Calorie Clash', () => {
    const w = world();
    expect(w.today).toBe('2026-11-18');
    const steps = comp(w, 'step-battle');
    expect(steps.result.phase).toBe('in-progress');
    expect(steps.currentDay).toBe(3);
    expect(steps.totalDays).toBe(7);
    expect(steps.competition.startDate).toBe('2026-11-16');
    const calories = comp(w, 'calorie-clash');
    expect(calories.result.phase).toBe('final');
    expect(calories.currentDay).toBeNull();
  });

  it('uses the production rules object when settings are at their defaults', () => {
    const w = world();
    expect(w.usesDemoSettings).toBe(false);
    for (const c of w.competitions) expect(c.result.rules).toBe(RULES_V1);
  });

  it('shows a shared first place in the Calorie Clash with default settings', () => {
    const calories = comp(world(), 'calorie-clash');
    const you = standingFor(calories, 'you');
    const maya = standingFor(calories, 'maya');
    expect(you.totalPoints).toBe(320);
    expect(maya.totalPoints).toBe(320);
    expect(you.rank).toBe(1);
    expect(maya.rank).toBe(1);
    expect(calories.result.standings.filter((s) => s.rank === 2)).toHaveLength(0);
  });

  it('applies a demo daily cap to demo competitions only', () => {
    const state = apply(initialDemoState('2026-11-18'), { type: 'set-cap', value: 100 });
    const w = world(state);
    expect(w.usesDemoSettings).toBe(true);
    for (const c of w.competitions) {
      expect(c.result.rules.dailyCapPoints).toBe(100);
      expect(c.result.rules.version).toBe('v1-demo');
      for (const s of c.result.standings) {
        for (const d of s.days) expect(d.points).toBeLessThanOrEqual(100);
      }
    }
    // Production defaults are unchanged.
    expect(RULES_V1.dailyCapPoints).toBe(200);
    expect(RULES_V1.pointsPerGoal).toBe(100);
  });

  it('scales points with the demo points-per-goal setting', () => {
    const state = apply(initialDemoState('2026-11-18'), { type: 'set-points-per-goal', value: 50 });
    expect(standingFor(comp(world(state), 'calorie-clash'), 'you').totalPoints).toBe(160);
  });

  it('re-scores with a changed demo goal and breaks the tie', () => {
    const state = apply(initialDemoState('2026-11-18'), {
      type: 'set-goal',
      categoryId: 'calorie-clash',
      playerId: 'maya',
      value: 200,
    });
    const calories = comp(world(state), 'calorie-clash');
    expect(standingFor(calories, 'maya').rank).toBe(1);
    expect(standingFor(calories, 'you').rank).toBe(2);
  });

  it('clamps settings to sensible ranges', () => {
    const state = apply(
      initialDemoState('2026-11-18'),
      { type: 'set-cap', value: -5 },
      { type: 'set-points-per-goal', value: Number.NaN },
      { type: 'set-goal', categoryId: 'step-battle', playerId: 'you', value: 1e9 },
    );
    expect(state.settings.dailyCapPoints).toBe(50);
    expect(state.settings.pointsPerGoal).toBe(10);
    expect(state.settings.goals['step-battle'].you).toBe(40000);
  });

  it('adds demo activity to your current day and its points', () => {
    const before = world();
    const added = apply(initialDemoState('2026-11-18'), {
      type: 'add-activity',
      categoryId: 'step-battle',
      date: '2026-11-18',
      amount: 5000,
    });
    const after = world(added);
    expect(after.yourDays[0].steps).toBe(before.yourDays[0].steps + 5000);
    const day = (w: DemoWorld) =>
      standingFor(comp(w, 'step-battle'), 'you').days.find((d) => d.date === '2026-11-18');
    expect(day(after)?.eligibleActivity).toBe(before.yourDays[0].steps + 5000);
    expect(day(after)?.points).toBeGreaterThan(day(before)?.points ?? Infinity);
  });

  it("models Alex's slow sync as pending days that confirm by the final result", () => {
    const w = world();
    const alex = standingFor(comp(w, 'step-battle'), 'alex');
    expect(alex.days.map((d) => d.status).slice(0, 4)).toEqual([
      'confirmed',
      'pending',
      'pending',
      'future',
    ]);
    const final = apply(initialDemoState('2026-11-18'), {
      type: 'advance-clock',
      toMs: w.jumps.finalStepBattle ?? 0,
      nowMs: NOW,
    });
    const fw = world(final);
    const steps = comp(fw, 'step-battle');
    expect(steps.result.phase).toBe('final');
    expect(standingFor(steps, 'alex').days.every((d) => d.status === 'confirmed')).toBe(true);
    expect(fw.jumps.finalStepBattle).toBeNull();
  });

  it('moves the demo clock forward only', () => {
    const w = world();
    const s = apply(initialDemoState('2026-11-18'), {
      type: 'advance-clock',
      toMs: w.jumps.nextDay,
      nowMs: NOW,
    });
    expect(world(s).today).toBe('2026-11-19');
    expect(comp(world(s), 'step-battle').currentDay).toBe(4);
    expect(demoReducer(s, { type: 'advance-clock', toMs: NOW - 1, nowMs: NOW })).toBe(s);
  });

  it('keeps questionable records private to their owner', () => {
    const steps = comp(world(), 'step-battle');
    const reasons = standingFor(steps, 'you').decisions.map((d) => [d.status, d.reason]);
    expect(reasons).toEqual(
      expect.arrayContaining([
        ['excluded', 'MANUAL_ENTRY'],
        ['held', 'UNKNOWN_SOURCE'],
      ]),
    );
    const publicYou = toPublicStandings(steps.result).find((s) => s.participantId === 'you');
    expect(publicYou).not.toHaveProperty('decisions');
    expect(publicYou).not.toHaveProperty('fairnessAtStart');
  });

  it('is deterministic, changes on shuffle, and resets to defaults', () => {
    const base = initialDemoState('2026-11-18');
    expect(world(base)).toEqual(world(base));
    const shuffled = apply(base, { type: 'shuffle' });
    expect(world(shuffled).yourDays).not.toEqual(world(base).yourDays);
    const changed = apply(
      base,
      { type: 'set-cap', value: 300 },
      { type: 'add-activity', categoryId: 'step-battle', date: '2026-11-18', amount: 1000 },
      { type: 'advance-clock', toMs: NOW + 86_400_000, nowMs: NOW },
    );
    expect(apply(changed, { type: 'reset', anchorDate: '2026-11-18' })).toEqual(base);
  });
});
