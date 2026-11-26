// world.js — builds the Senja archipelago from a fixed seed.
// Islands are smooth Gaussian hills rising out of the sea; runways sit on
// flattened island tops; rings hang over the route; storm gusts live in
// bands the delivery mission must cross.

import { STRIPS, WORLD_LENGTH, MISSIONS } from './config.js';
import { makeRng, makeNoise1D } from './random.js';

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function buildWorld(seed) {
  const rng = makeRng(seed);
  const ridgeNoise = makeNoise1D(seed + 77, 900);
  const detailNoise = makeNoise1D(seed + 131, 260);

  // Six islands, spaced along the route, each with its own height and bulk.
  const islands = [
    { center: 900, halfWidth: 1500, peak: 150 },
    { center: 4200, halfWidth: 1150, peak: 260 },
    { center: 7800, halfWidth: 1400, peak: 190 },
    { center: 11500, halfWidth: 1000, peak: 330 },
    { center: 14900, halfWidth: 1450, peak: 170 },
    { center: 18800, halfWidth: 1100, peak: 290 },
    { center: 22800, halfWidth: 1600, peak: 160 },
  ];

  // Flatten the ground under each runway so the strip is level.
  const runways = STRIPS.map((strip) => {
    const island = islands.reduce((best, candidate) =>
      Math.abs(candidate.center - strip.x) < Math.abs(best.center - strip.x)
        ? candidate
        : best,
    );
    return {
      name: strip.name,
      short: strip.short,
      x: strip.x,
      width: strip.width,
      groundY: island.peak * 0.62,
    };
  });

  function rawHeightAt(x) {
    let height = -60;
    for (const island of islands) {
      const distance = Math.abs(x - island.center) / island.halfWidth;
      if (distance < 1) {
        const falloff = Math.exp(-distance * distance * 2.4);
        height = Math.max(height, island.peak * falloff);
      }
    }
    // Gentle undulation on top of the big hills, none in the open sea.
    if (height > 0) {
      height += (detailNoise(x) - 0.5) * 26;
    }
    return height;
  }

  function terrainHeightAt(x) {
    const clamped = Math.max(0, Math.min(WORLD_LENGTH, x));
    let height = rawHeightAt(clamped);
    // Level the earth under every runway.
    for (const runway of runways) {
      const half = runway.width / 2 + 90;
      const distance = Math.abs(clamped - runway.x);
      if (distance < half) {
        const blend = smoothstep(half, half * 0.45, distance);
        height = height * (1 - blend) + runway.groundY * blend;
      }
    }
    return height;
  }

  // Ring Run: eight rings weaving between the islands at varied heights.
  const ringMission = MISSIONS[0];
  const ringXs = [2600, 5200, 6800, 9600, 12600, 16200, 19800, 21600];
  const rings = ringXs.slice(0, ringMission.ringCount).map((x, index) => {
    const ground = terrainHeightAt(x);
    const altitude = Math.max(ground + 130, 170 + rng.range(-30, 190));
    return {
      index,
      x,
      y: Math.min(altitude, 640),
      radius: 92,
      passed: false,
    };
  });

  // Storm Delivery: four gust bands between the start and Pulau Timur.
  const gusts = [
    { x0: 9800, x1: 11800, lift: 26, push: 14 },
    { x0: 13300, x1: 15200, lift: -22, push: -18 },
    { x0: 17200, x1: 19100, lift: 30, push: 10 },
    { x0: 20400, x1: 22100, lift: -26, push: -12 },
  ];

  // Clouds drift above the route; their positions are seeded, not timed.
  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    clouds.push({
      x: rng.range(0, WORLD_LENGTH),
      y: rng.range(560, 980),
      scale: rng.range(0.7, 1.9),
      speed: rng.range(2, 7),
    });
  }

  // Distant birds, purely for life in the sky.
  const birds = [];
  for (let i = 0; i < 9; i += 1) {
    birds.push({
      x: rng.range(0, WORLD_LENGTH),
      y: rng.range(240, 520),
      phase: rng.range(0, Math.PI * 2),
      speed: rng.range(6, 14),
    });
  }

  // Early stars, fixed in the upper sky for the renderer.
  const stars = [];
  for (let i = 0; i < 70; i += 1) {
    stars.push({
      x: rng.range(0, 1280),
      y: rng.range(0, 260),
      size: rng.range(1, 2.4),
      alpha: rng.range(0.25, 0.9),
      phase: rng.range(0, Math.PI * 2),
    });
  }

  return {
    seed,
    islands,
    runways,
    rings,
    gusts,
    clouds,
    birds,
    stars,
    terrainHeightAt,
    ridgeNoise,
    groundAtRunway(runway) {
      return runway.groundY;
    },
    gustAt(x) {
      for (const gust of gusts) {
        if (x >= gust.x0 && x <= gust.x1) return gust;
      }
      return null;
    },
    runwayAt(x) {
      for (const runway of runways) {
        if (Math.abs(x - runway.x) <= runway.width / 2) return runway;
      }
      return null;
    },
    nextRunwayAfter(x) {
      for (const runway of runways) {
        if (runway.x > x + 40) return runway;
      }
      return runways[runways.length - 1];
    },
  };
}
