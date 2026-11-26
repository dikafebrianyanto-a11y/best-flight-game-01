// config.js — every tunable number for Senja Flight in one place.
// Units: world distances are metres, altitudes are metres above the sea,
// speeds are knots, times are seconds. The canvas is 1280 x 720.

export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 720;

// The archipelago the pilot flies across, west to east.
export const WORLD_LENGTH = 26000;
export const SEA_LEVEL = 0;
export const MAX_ALTITUDE = 1100;

// Camera: how much of the world fits across the screen at zoom 1.
export const CAMERA_VIEW_WIDTH = 1500;

// The little prop plane the player flies.
export const PLANE = {
  length: 96,
  height: 34,
  minSpeed: 55, // below this the wing stops flying: stall
  maxSpeed: 235, // above this the airframe shakes apart
  cruiseSpeed: 145,
  takeoffSpeed: 85,
  accelPerSecond: 34,
  dragPerSecond: 12,
  pitchRate: 1.55, // radians per second of pitch authority
  maxPitch: 0.62,
  bankRate: 1.9,
  maxBank: 0.85,
  climbEfficiency: 0.92,
  fuelCapacity: 100,
  fuelBurnPerSecond: 0.55, // at full throttle; scales with throttle
  fuelBurnIdle: 0.08,
  damagePerSecondOverspeed: 6,
  damageHardLanding: 34,
  damageTerrainHit: 100,
  damageDitch: 100,
};

// Landing judgement: what counts as a good touchdown.
export const LANDING = {
  maxVerticalSpeed: 4.5, // m/s of sink; harder than this damages the gear
  maxSpeed: 120, // knots; faster than this and the strip runs out
  minSpeed: 62,
  perfectVerticalSpeed: 1.8,
  perfectSpeed: 88,
};

// Scoring.
export const SCORE = {
  ring: 500,
  ringTimeBonusPerSecond: 12,
  landing: 1000,
  perfectLandingBonus: 400,
  delivery: 2500,
  missionCompleteBonus: 800,
};

// Dusk palette: one sunset, used by sky, sea, ridges and the plane alike.
export const PALETTE = {
  skyTop: '#2b1d52',
  skyMid: '#7a3b6e',
  skyLow: '#e2603f',
  horizonGlow: '#ffb347',
  sunCore: '#ffe9a8',
  sunGlow: '#ff7a2f',
  seaDeep: '#1d2f57',
  seaDusk: '#4a3a72',
  seaGlitter: '#ffb347',
  ridgeFar: '#4b2d63',
  ridgeMid: '#3a2350',
  ridgeNear: '#2c1c3e',
  island: '#233d2b',
  islandDark: '#16281d',
  beach: '#d9a066',
  runway: '#3c3f4a',
  runwayLine: '#f2e6c8',
  planeBody: '#f4ead2',
  planeTrim: '#c94f2e',
  planeWing: '#e8d9b0',
  hudPanel: 'rgba(12, 10, 28, 0.72)',
  hudText: '#ffe9a8',
  hudGreen: '#7fe08a',
  hudAmber: '#ffb347',
  hudRed: '#ff5a4e',
  hudCyan: '#8fd8ff',
};

// The three sorties. Each one is a different way to fly the same sky.
export const MISSIONS = [
  {
    id: 'rings',
    index: 0,
    key: '1',
    name: 'Ring Run',
    shortName: 'RING RUN',
    tagline: 'Fly through 8 rings against the clock',
    briefing:
      'Eight glowing rings hang over the islands at dusk. Thread every one ' +
      'before the clock runs out. Rings reward smooth, fast flying — ' +
      'throttle discipline beats full power.',
    timeLimit: 150,
    ringCount: 8,
    startFuel: 100,
    objective: 'Fly through all 8 rings',
  },
  {
    id: 'hop',
    index: 1,
    key: '2',
    name: 'Island Hop',
    shortName: 'ISLAND HOP',
    tagline: 'Land on three airstrips, soft as you can',
    briefing:
      'Three island strips, three landings. Come in slow, level and over ' +
      'the numbers: a hard touchdown bends the gear and a fast one runs ' +
      'out of runway. Each good landing refuels the tanks.',
    timeLimit: 420,
    stripsToVisit: 3,
    startFuel: 100,
    objective: 'Land on 3 airstrips in order',
  },
  {
    id: 'storm',
    index: 2,
    key: '3',
    name: 'Storm Delivery',
    shortName: 'STORM DELIVERY',
    tagline: 'Carry medical cargo through the gusts',
    briefing:
      'A clinic on Pulau Timur is waiting on medical cargo. The storm ' +
      'front throws gusts that shove the plane up and sideways — ride ' +
      'them, do not fight them. Land with the cargo and the fuel to spare.',
    timeLimit: 360,
    startFuel: 78,
    cargo: true,
    objective: 'Deliver the cargo to Pulau Timur',
  },
];

// Island airstrips, west to east. The world builder places them on islands.
export const STRIPS = [
  { name: 'SENJA FIELD', short: 'SENJA', x: 900, width: 620 },
  { name: 'PULAU KARANG', short: 'KARANG', x: 7800, width: 560 },
  { name: 'PULAU BARAT', short: 'BARAT', x: 14900, width: 560 },
  { name: 'PULAU TIMUR', short: 'TIMUR', x: 22800, width: 640 },
];

// Fixed world seed: the same archipelago every session, so a run is fair.
export const WORLD_SEED = 20261126;

export const SHOT_SEED = 1;
