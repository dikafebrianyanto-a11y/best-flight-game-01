// random.js — small deterministic random helpers for Senja Flight.
// One seeded generator drives the whole archipelago, so the same seed
// always builds the same islands, rings and gusts.

export function mulberry32(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function makeRng(seed) {
  const next = mulberry32(typeof seed === 'string' ? hashSeed(seed) : seed);
  return {
    next,
    range(min, max) {
      return min + (max - min) * next();
    },
    int(min, max) {
      return Math.floor(min + (max - min + 1) * next());
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    chance(probability) {
      return next() < probability;
    },
  };
}

// Smooth 1-D value noise over a seeded table, for ridge silhouettes.
export function makeNoise1D(seed, step) {
  const rng = makeRng(seed);
  const table = [];
  for (let i = 0; i < 256; i += 1) table.push(rng.next());
  function valueAt(index) {
    return table[((index % 256) + 256) % 256];
  }
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  return function noiseAt(x) {
    const position = x / step;
    const left = Math.floor(position);
    const fraction = position - left;
    const a = valueAt(left);
    const b = valueAt(left + 1);
    return a + (b - a) * smooth(fraction);
  };
}
