/** Seeded, deterministic randomness for simulations (synthetic data only). */

/** FNV-1a string hash → 32-bit unsigned integer. */
export function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mulberry32 PRNG: returns values in [0, 1). Same seed → same sequence. */
export function createRandom(seed: number | string): () => number {
  let state = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample (Box–Muller). */
export function normal(random: () => number): number {
  const u = Math.max(random(), 1e-12);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Log-normal multiplier with mean 1 and the given coefficient of variation: realistic
 * day-to-day activity (never negative, occasional big days).
 */
export function dailyMultiplier(random: () => number, cv: number): number {
  const sigma = Math.sqrt(Math.log(1 + cv * cv));
  return Math.exp(sigma * normal(random) - (sigma * sigma) / 2);
}
