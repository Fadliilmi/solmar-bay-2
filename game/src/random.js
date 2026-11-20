// Seeded random numbers for Solmar Bay: one small deterministic generator so
// the same seed always builds the same city, the same traffic and the same
// screenshot scenes.

/** Mulberry32: a tiny fast seeded PRNG with a full 32-bit period. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seeded random source with the helpers the city builder uses. */
export class SeededRandom {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.next = mulberry32(this.seed);
  }
  /** A float in [0, 1). */
  float() { return this.next(); }
  /** A float in [min, max). */
  range(min, max) { return min + (max - min) * this.next(); }
  /** An integer in [min, max] inclusive. */
  int(min, max) { return min + Math.floor(this.next() * (max - min + 1)); }
  /** One element of an array, uniformly. */
  pick(list) { return list[Math.floor(this.next() * list.length)]; }
  /** True with the given probability. */
  chance(p) { return this.next() < p; }
  /** A shuffled copy of an array. */
  shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }
}

/** A stable 32-bit hash of a short string, for turning names into seeds. */
export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
