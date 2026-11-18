import { dailyCentiPoints, isCapped, lockGoal, validateGoal } from '../points';
import { RULES_V1 } from '../rules';

const pts = (activity: number, goal: number) => dailyCentiPoints(activity, goal, RULES_V1) / 100;

describe('daily points', () => {
  it('goal 10,000: 12,000 → 120; 25,000 → 200 (cap); 0 → 0', () => {
    expect(pts(12000, 10000)).toBe(120);
    expect(pts(25000, 10000)).toBe(200);
    expect(isCapped(dailyCentiPoints(25000, 10000, RULES_V1), RULES_V1)).toBe(true);
    expect(pts(0, 10000)).toBe(0);
  });

  it('equal percentage of different personal goals → equal points', () => {
    expect(pts(6000, 5000)).toBe(pts(14400, 12000));
    expect(pts(350, 500)).toBe(pts(7000, 10000));
  });

  it('caps each day individually, so daily caps differ from capping a weekly total', () => {
    const goal = 10000;
    const week = [30000, 2000, 2000, 2000, 2000, 2000, 2000];
    const sumOfCappedDays = week.reduce((s, a) => s + pts(a, goal), 0);
    const weeklyPercentCapped =
      Math.min(200, (100 * week.reduce((s, a) => s + a, 0)) / (goal * 7)) * 7;
    expect(sumOfCappedDays).toBe(320); // 200 + 6 × 20
    expect(weeklyPercentCapped).toBeCloseTo(420, 5); // 60% blended × 7 days: hides the exceptional day's cap
    expect(sumOfCappedDays).not.toBe(weeklyPercentCapped);
  });

  it('an exceptional day can offset weak days', () => {
    const steady = [10000, 10000].reduce((s, a) => s + pts(a, 10000), 0);
    const spiky = [19000, 1000].reduce((s, a) => s + pts(a, 10000), 0);
    expect(spiky).toBe(steady);
  });

  it('uses deterministic 0.01-point precision with half-up rounding', () => {
    expect(dailyCentiPoints(3333, 10000, RULES_V1)).toBe(3333); // 33.33
    expect(dailyCentiPoints(1, 3, RULES_V1)).toBe(3333); // 33.333… → 33.33
    expect(dailyCentiPoints(2, 3, RULES_V1)).toBe(6667); // 66.666… → 66.67
    expect(dailyCentiPoints(12345, 100000, RULES_V1)).toBe(1235); // 12.345 → 12.35
  });

  it.each([0, -5, Number.NaN, Infinity, -Infinity])('rejects goal %p', (goal) => {
    expect(() => dailyCentiPoints(100, goal, RULES_V1)).toThrow('Invalid daily goal');
    expect(validateGoal(goal).ok).toBe(false);
  });

  it('treats nonfinite or negative activity as 0 instead of crashing', () => {
    expect(pts(Number.NaN, 10000)).toBe(0);
    expect(pts(-500, 10000)).toBe(0);
    expect(pts(Infinity, 10000)).toBe(0);
  });

  it('does not block easy goals; an optional floor only rejects nonsense', () => {
    expect(validateGoal(1).ok).toBe(true);
    expect(validateGoal(50, 100).ok).toBe(false);
  });

  it('locked goals are frozen copies, unaffected by later profile edits', () => {
    const profile = { stepsGoal: 8000 };
    const locked = lockGoal('steps', profile.stepsGoal, '2026-11-02T06:00:00Z');
    profile.stepsGoal = 4000;
    expect(locked.dailyGoal).toBe(8000);
    expect(Object.isFrozen(locked)).toBe(true);
  });
});
