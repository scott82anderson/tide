/** Shared helpers for seed data modules. */

/** Build a UTC date at 14:00Z (10:00 EDT) from a YYYY-MM-DD string. */
export function d(iso: string, hourUtc = 14): Date {
  return new Date(`${iso}T${String(hourUtc).padStart(2, "0")}:00:00.000Z`);
}

/** Local America/New_York (EDT, UTC-4) hour on a given day to a UTC Date. */
export function local(iso: string, hourLocal: number): Date {
  return new Date(`${iso}T${String(hourLocal + 4).padStart(2, "0")}:00:00.000Z`);
}

/** Deterministic PRNG (mulberry32) so the seed is stable between runs. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const json = (v: unknown) => JSON.stringify(v);
