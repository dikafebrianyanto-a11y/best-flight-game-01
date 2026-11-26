// shots.js — the four fixed scenes the screenshots are taken from.
// Each scene is a frozen moment: same seed, same numbers, same pixels,
// every time. The browser renders ?shot=<name>&seed=1 with no animation
// time dependence, so a screenshot is a render of the game's own code.

import { MISSIONS, WORLD_SEED } from './config.js';
import { buildWorld } from './world.js';

const FIXED_TIME = 12.5;
const FIXED_PROP_ANGLE = 0.7;

function basePlane(overrides) {
  return {
    x: 0,
    y: 220,
    speed: 145,
    heading: 90,
    throttle: 0.6,
    fuel: 82,
    damage: 0,
    pitch: 0.06,
    bank: 0.08,
    verticalSpeed: 1.2,
    ...overrides,
  };
}

function baseCamera(overrides) {
  return {
    centerX: 0,
    centerAlt: 90,
    scale: 1280 / 1500,
    shakeX: 0,
    shakeY: 0,
    ...overrides,
  };
}

function baseMissionState(overrides) {
  return {
    objective: '',
    timeLeft: 120,
    score: 0,
    nextTarget: null,
    ...overrides,
  };
}

function buildCoverScene(seed) {
  const world = buildWorld(WORLD_SEED);
  const plane = basePlane({ x: 6900, y: 235, speed: 152, throttle: 0.62, pitch: 0.04 });
  const runway = world.runways[1];
  const camera = baseCamera({ centerX: plane.x + 350, centerAlt: 92 });
  const mission = MISSIONS[1];
  const missionState = baseMissionState({
    objective: 'Land on 3 airstrips in order',
    timeLeft: 386,
    score: 1000,
    nextTarget: {
      label: runway.name,
      distance: runway.x - plane.x,
      altitudeText: 'STRIP AHEAD',
      offScreen: false,
      direction: 1,
    },
  });
  return {
    name: 'cover', mode: 'flying', world, plane, camera, mission, missionState,
    time: FIXED_TIME, fixedPropAngle: FIXED_PROP_ANGLE, planeScale: 1,
    warnings: [], toast: 'LANDED SENJA FIELD · NEXT: PULAU KARANG',
  };
}

function buildRingsScene(seed) {
  const world = buildWorld(WORLD_SEED);
  world.rings[0].passed = true;
  world.rings[1].passed = true;
  const ring = world.rings[2];
  const plane = basePlane({
    x: ring.x - 430, y: ring.y + 30, speed: 168, throttle: 0.78,
    pitch: -0.05, bank: -0.12, fuel: 74,
  });
  const camera = baseCamera({ centerX: plane.x + 320, centerAlt: plane.y - 130 });
  const mission = MISSIONS[0];
  const missionState = baseMissionState({
    objective: 'Fly through all 8 rings',
    timeLeft: 104,
    score: 1000,
    nextTarget: {
      label: `RING ${ring.index + 1} OF 8`,
      distance: ring.x - plane.x,
      altitudeText: 'THREAD THE GLOW',
      offScreen: false,
      direction: 1,
    },
  });
  return {
    name: 'rings', mode: 'flying', world, plane, camera, mission, missionState,
    time: FIXED_TIME, fixedPropAngle: FIXED_PROP_ANGLE, planeScale: 1,
    warnings: [], toast: 'RING 2 OF 8 · +500',
  };
}

function buildLandingScene(seed) {
  const world = buildWorld(WORLD_SEED);
  const plane = basePlane({
    x: 7300, y: 96, speed: 96, throttle: 0.34, pitch: -0.1,
    bank: 0.02, verticalSpeed: -2.4, fuel: 61,
  });
  const runway = world.runways[1];
  const camera = baseCamera({ centerX: plane.x + 330, centerAlt: 34 });
  const mission = MISSIONS[1];
  const missionState = baseMissionState({
    objective: 'Land on 3 airstrips in order',
    timeLeft: 318,
    score: 2400,
    nextTarget: {
      label: runway.name,
      distance: runway.x - plane.x,
      altitudeText: 'FINAL · GEAR DOWN',
      offScreen: false,
      direction: 1,
    },
  });
  return {
    name: 'landing', mode: 'flying', world, plane, camera, mission, missionState,
    time: FIXED_TIME, fixedPropAngle: FIXED_PROP_ANGLE, planeScale: 1,
    warnings: [], toast: 'FINAL APPROACH · PULAU KARANG',
  };
}

function buildCockpitScene(seed) {
  const world = buildWorld(WORLD_SEED);
  const runway = world.runways[0];
  const plane = basePlane({
    x: runway.x - 40, y: runway.groundY + 4, speed: 0, throttle: 0,
    pitch: 0, bank: 0, verticalSpeed: 0, fuel: 44, heading: 90,
  });
  const camera = baseCamera({
    centerX: plane.x + 180, centerAlt: runway.groundY - 30, scale: 1.7,
  });
  const mission = MISSIONS[1];
  const missionState = baseMissionState({
    objective: 'Land on 3 airstrips in order',
    timeLeft: 96,
    score: 4850,
    nextTarget: null,
  });
  const result = {
    success: true,
    headline: 'Three strips, three soft landings — the mail got through.',
    lines: [
      'LANDING SENJA FIELD  +1000  ·  PERFECT TOUCHDOWN  +400',
      'LANDING PULAU KARANG  +1000  ·  PERFECT TOUCHDOWN  +400',
      'LANDING PULAU BARAT  +1000  ·  TIME BONUS  +250',
      'MISSION BONUS  +800',
    ],
    score: 4850,
  };
  return {
    name: 'cockpit', mode: 'complete', world, plane, camera, mission, missionState,
    time: FIXED_TIME, fixedPropAngle: FIXED_PROP_ANGLE, planeScale: 2.2,
    warnings: [], toast: null, result, brightEnd: true,
  };
}

const SCENE_BUILDERS = {
  cover: buildCoverScene,
  rings: buildRingsScene,
  landing: buildLandingScene,
  cockpit: buildCockpitScene,
};

export function shotNames() {
  return Object.keys(SCENE_BUILDERS);
}

// Build one frozen scene. Unknown names fall back to the cover.
export function buildShotScene(name, seed) {
  const builder = SCENE_BUILDERS[name] || SCENE_BUILDERS.cover;
  return builder(seed === undefined ? 1 : seed);
}
