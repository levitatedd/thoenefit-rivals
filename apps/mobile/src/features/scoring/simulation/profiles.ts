import type { MetricId } from '../types';

/**
 * Synthetic fitness profiles. Means are typical daily totals; `cv` is the day-to-day
 * coefficient of variation. These are invented for simulation, not population statistics.
 */
export interface FitnessProfile {
  id: ProfileId;
  label: string;
  mean: Record<MetricId, number>;
  cv: number;
}

export type ProfileId = 'light' | 'moderate' | 'active' | 'athlete';

export const PROFILES: Readonly<Record<ProfileId, FitnessProfile>> = Object.freeze({
  light: { id: 'light', label: 'Light', mean: { steps: 5000, activeEnergyKcal: 250 }, cv: 0.3 },
  moderate: {
    id: 'moderate',
    label: 'Moderate',
    mean: { steps: 8500, activeEnergyKcal: 450 },
    cv: 0.3,
  },
  active: { id: 'active', label: 'Active', mean: { steps: 12000, activeEnergyKcal: 650 }, cv: 0.3 },
  athlete: {
    id: 'athlete',
    label: 'Athlete',
    mean: { steps: 17000, activeEnergyKcal: 950 },
    cv: 0.3,
  },
});
