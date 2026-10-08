// Seeded randomness: the same SEED gives the same ledger. Identities and passwords never come from here
// (seed-demo.mts uses node:crypto), so the data stream depends on SEED alone.

export interface Rng {
  next(): number;
  chance(probability: number): boolean;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** A whole number of `unit`s near the middle of [min, max], log-normally spread and clamped to the range. */
  amount(min: number, max: number, unit?: number): number;
  /** A wall-clock time between two `HH:MM`s, inclusive. */
  time(from: string, to: string): string;
  /** A description, or none ~25% of the time, as real users skip it. */
  maybe(text: string): string | null;
}

function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const pad = (value: number) => String(value).padStart(2, '0');

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);
  const gauss = () => {
    let u = 0;
    while (u === 0) u = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  const rng: Rng = {
    next,
    chance: (probability) => next() < probability,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)]!,
    amount(min, max, unit = 1000) {
      const value = Math.exp(Math.log((min + max) / 2) + (Math.log(max / min) / 4) * gauss());
      const low = Math.ceil(min / unit) * unit;
      const high = Math.floor(max / unit) * unit;
      return Math.min(high, Math.max(low, Math.round(value / unit) * unit));
    },
    time(from, to) {
      const minute = minutesOf(from) + Math.floor(next() * (minutesOf(to) - minutesOf(from) + 1));
      return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
    },
    maybe: (text) => (next() < 0.25 ? null : text),
  };
  return rng;
}
