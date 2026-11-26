// main.js — Senja Flight: game loop, flight physics, missions, menus.
// A small prop plane, three sorties over one dusk archipelago, and a
// deterministic shot mode that renders a frozen scene for screenshots.

import {
  VIEW_WIDTH, VIEW_HEIGHT, WORLD_SEED, WORLD_LENGTH, MAX_ALTITUDE,
  PLANE, LANDING, SCORE, MISSIONS,
} from './config.js';
import { buildWorld } from './world.js';
import { Input } from './input.js';
import { renderFrame } from './render.js';
import { SoundEngine } from './audio.js';
import { buildShotScene } from './shots.js';

const KNOTS_TO_MS = 0.514;
const GROUND_SPEED_FACTOR = 3.0;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function easeToward(current, target, rate, dt) {
  const step = 1 - Math.exp(-rate * dt);
  return current + (target - current) * step;
}

class SenjaFlight {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input(canvas);
    this.sound = new SoundEngine();
    this.world = buildWorld(WORLD_SEED);
    this.time = 0;
    this.mode = 'title';
    this.mission = MISSIONS[0];
    this.plane = this.freshPlane();
    this.camera = { centerX: 900, centerAlt: 120, scale: VIEW_WIDTH / 1500, shakeX: 0, shakeY: 0 };
    this.missionState = this.freshMissionState();
    this.result = null;
    this.toast = null;
    this.toastUntil = 0;
    this.events = [];
    this.lastWarningAt = 0;
    this.shotScene = null;
  }

  freshPlane() {
    return {
      x: 900, y: 100, speed: 0, throttle: 0, pitch: 0, bank: 0,
      heading: 90, fuel: 100, damage: 0, verticalSpeed: 0, onGround: true,
    };
  }

  freshMissionState() {
    return {
      score: 0, timeLeft: this.mission.timeLimit, ringsPassed: 0,
      stripsLanded: [], nextStripIndex: 0, cargoDelivered: false,
      objective: this.mission.objective, nextTarget: null,
    };
  }

  startMission(mission) {
    this.mission = mission;
    this.world = buildWorld(WORLD_SEED);
    const strip = this.world.runways[0];
    this.plane = this.freshPlane();
    this.plane.x = strip.x;
    this.plane.y = strip.groundY + 2;
    this.plane.fuel = mission.startFuel;
    this.plane.onGround = true;
    this.missionState = this.freshMissionState();
    this.events = [];
    this.result = null;
    this.toast = null;
    this.camera.centerX = strip.x + 200;
    this.camera.centerAlt = strip.groundY + 40;
    this.mode = 'flying';
    this.sound.ensure();
    this.showToast(`${mission.name.toUpperCase()} — ${mission.objective}`);
  }

  showToast(message, seconds) {
    this.toast = message;
    this.toastUntil = this.time + (seconds || 3.5);
  }

  addScore(points, label) {
    this.missionState.score += points;
    this.events.push(`${label}  +${points}`);
  }

  // One physics step while flying.
  stepFlight(dt) {
    const plane = this.plane;
    const state = this.missionState;
    const now = this.time;

    // Throttle follows the stick; a dead tank means a dead engine.
    const throttleInput = this.input.throttleAxis();
    if (plane.fuel > 0) {
      plane.throttle = clamp(plane.throttle + throttleInput * 0.9 * dt, 0, 1);
    } else {
      plane.throttle = Math.max(0, plane.throttle - dt);
    }

    // Speed chases what the throttle asks for; drag wins when it is low.
    const desiredSpeed = 20 + plane.throttle * (PLANE.maxSpeed - 20);
    const rate = desiredSpeed > plane.speed ? PLANE.accelPerSecond : PLANE.dragPerSecond;
    plane.speed += clamp(desiredSpeed - plane.speed, -rate * dt, rate * dt);
    plane.speed = clamp(plane.speed, 0, PLANE.maxSpeed + 25);

    // Pitch and bank ease toward the stick, never snap.
    const pitchTarget = this.input.pitchAxis(now) * PLANE.maxPitch;
    plane.pitch = easeToward(plane.pitch, pitchTarget, PLANE.pitchRate * 2.2, dt);
    const bankTarget = this.input.bankAxis() * PLANE.maxBank;
    plane.bank = easeToward(plane.bank, bankTarget, PLANE.bankRate * 2.2, dt);

    // Bank turns the nose; level flight drifts the heading back to east.
    plane.heading += plane.bank * 26 * dt;
    plane.heading = easeToward(plane.heading, 90, 0.35, dt);
    plane.heading = ((plane.heading % 360) + 360) % 360;

    const stalled = plane.speed < PLANE.minSpeed && !plane.onGround;
    const forwardMs = plane.speed * KNOTS_TO_MS;
    // Climb rate: pitch times airspeed, scaled so the flight path roughly
    // matches the nose attitude the player sees on screen.
    const climbRate = (pitch) => Math.sin(pitch) * forwardMs * 1.15;
    let verticalSpeed = climbRate(plane.pitch);

    if (stalled) {
      // The wing gives up: nose drops, the plane sinks, the horn sounds.
      plane.pitch = easeToward(plane.pitch, -0.28, 2.5, dt);
      verticalSpeed = climbRate(plane.pitch) - 14;
      if (now - this.lastWarningAt > 1.2) {
        this.sound.warningBeep();
        this.lastWarningAt = now;
      }
    }

    // Storm gusts shove the plane around inside their bands.
    let inGust = false;
    if (this.mission.id === 'storm' && !plane.onGround) {
      const gust = this.world.gustAt(plane.x);
      if (gust) {
        inGust = true;
        verticalSpeed += gust.lift;
        plane.x += gust.push * dt;
      }
    }

    plane.verticalSpeed = verticalSpeed;
    plane.x += Math.cos(plane.pitch) * forwardMs * GROUND_SPEED_FACTOR * dt;
    plane.y += verticalSpeed * dt;
    plane.x = clamp(plane.x, 60, WORLD_LENGTH - 60);
    plane.y = clamp(plane.y, 0, MAX_ALTITUDE);

    // Fuel burns with the throttle; an empty tank glides, it does not fall.
    plane.fuel = Math.max(0, plane.fuel
      - (PLANE.fuelBurnIdle + plane.throttle * PLANE.fuelBurnPerSecond) * dt);

    // Overspeed shakes the airframe and bends it, a little at a time.
    if (plane.speed > PLANE.maxSpeed) {
      plane.damage += PLANE.damagePerSecondOverspeed * dt;
    }
    if (plane.damage >= 100) {
      this.endFlight(false, 'The airframe came apart in the overspeed.');
      return;
    }

    // Ground contact: runway, hillside, or sea. Over open water the
    // terrain sits below sea level, so the sea surface itself is the floor.
    const ground = this.world.terrainHeightAt(plane.x);
    const contactLevel = Math.max(ground, 2);
    if (plane.y <= contactLevel + 2) {
      this.handleGroundContact(ground);
      if (this.mode !== 'flying') return;
    }
    // Rolling on a strip: stay pinned to the ground until takeoff speed.
    if (plane.onGround) {
      plane.y = this.world.terrainHeightAt(plane.x) + 2;
      plane.verticalSpeed = 0;
    }

    // Rings: thread the glow.
    if (this.mission.id === 'rings') this.checkRings();

    // Clock.
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      this.endFlight(false, 'Out of time — the dusk closed in.');
      return;
    }

    // Camera: look ahead of the nose, settle above the plane.
    const lookAhead = 180 + plane.speed * 1.1;
    this.camera.centerX = easeToward(this.camera.centerX, plane.x + lookAhead, 3, dt);
    this.camera.centerAlt = easeToward(this.camera.centerAlt, plane.y - 55, 2.2, dt);
    const shake = (plane.speed > PLANE.maxSpeed || inGust) ? 3.2 : 0;
    this.camera.shakeX = shake ? (Math.random() - 0.5) * shake : 0;
    this.camera.shakeY = shake ? (Math.random() - 0.5) * shake : 0;

    this.updateNextTarget();
    this.sound.updateFlight(plane.throttle, plane.speed, plane.onGround);
  }

  handleGroundContact(ground) {
    const plane = this.plane;
    const runway = this.world.runwayAt(plane.x);
    plane.y = ground + 2;
    if (runway) {
      const sink = -plane.verticalSpeed;
      const fast = plane.speed > LANDING.maxSpeed;
      const slow = plane.speed < LANDING.minSpeed && !plane.onGround;
      if (plane.onGround) {
        // Rolling: friction bleeds speed, steering stays live.
        plane.speed = Math.max(0, plane.speed - 26 * 0.016);
        return;
      }
      if (sink <= LANDING.maxVerticalSpeed && !fast && !slow) {
        plane.onGround = true;
        plane.verticalSpeed = 0;
        plane.pitch = 0;
        this.sound.landingThud();
        this.onTouchdown(runway, sink);
      } else if (sink > LANDING.maxVerticalSpeed) {
        plane.damage += PLANE.damageHardLanding;
        plane.y = ground + 14;
        plane.verticalSpeed = 4;
        plane.pitch = 0.1;
        this.showToast('HARD LANDING — gear damaged');
        this.sound.landingThud();
        if (plane.damage >= 100) {
          this.endFlight(false, 'The hard landing broke the undercarriage.');
        }
      } else if (fast) {
        this.endFlight(false, 'Too fast for the strip — ran off the far end.');
      } else {
        plane.onGround = true;
        plane.verticalSpeed = 0;
        this.sound.landingThud();
        this.onTouchdown(runway, sink);
      }
      return;
    }
    if (ground <= 2) {
      this.endFlight(false, 'Ditched in the sea off the islands.');
    } else {
      this.endFlight(false, 'Flew into the hillside.');
    }
  }

  onTouchdown(runway, sink) {
    const state = this.missionState;
    const perfect = sink <= LANDING.perfectVerticalSpeed
      && this.plane.speed <= LANDING.perfectSpeed;
    if (this.mission.id === 'hop') {
      const expected = [1, 2, 3][state.nextStripIndex];
      if (this.world.runways.indexOf(runway) === expected) {
        this.addScore(SCORE.landing, `LANDING ${runway.name}`);
        if (perfect) this.addScore(SCORE.perfectLandingBonus, 'PERFECT TOUCHDOWN');
        state.stripsLanded.push(runway.name);
        state.nextStripIndex += 1;
        this.plane.fuel = Math.min(100, this.plane.fuel + 25);
        this.showToast(`LANDED ${runway.name} — tanks topped up`);
        if (state.nextStripIndex >= this.mission.stripsToVisit) {
          this.endFlight(true, 'All three strips, soft as you can.');
        }
      } else {
        this.showToast(`Wrong strip — next is ${this.nextHopStripName()}`);
      }
      return;
    }
    if (this.mission.id === 'storm') {
      if (runway.name === 'PULAU TIMUR') {
        this.addScore(SCORE.delivery, 'CARGO DELIVERED');
        this.endFlight(true, 'The clinic has its medicine. Cargo delivered.');
      } else {
        this.plane.fuel = Math.min(100, this.plane.fuel + 30);
        this.showToast(`LANDED ${runway.name} — refuelled, cargo still aboard`);
      }
      return;
    }
    // Ring Run: any strip is a breather, not the goal.
    this.plane.fuel = Math.min(100, this.plane.fuel + 20);
    this.showToast(`LANDED ${runway.name} — refuelled`);
  }

  nextHopStripName() {
    const expected = [1, 2, 3][this.missionState.nextStripIndex];
    return this.world.runways[expected] ? this.world.runways[expected].name : '—';
  }

  checkRings() {
    const state = this.missionState;
    for (const ring of this.world.rings) {
      if (ring.passed) continue;
      const dx = Math.abs(this.plane.x - ring.x);
      const dy = Math.abs(this.plane.y - ring.y);
      if (dx < 70 && dy < ring.radius) {
        ring.passed = true;
        state.ringsPassed += 1;
        this.addScore(SCORE.ring, `RING ${ring.index + 1}`);
        this.sound.ringChime();
        this.showToast(`RING ${ring.index + 1} OF 8  ·  +${SCORE.ring}`, 2);
        if (state.ringsPassed >= this.mission.ringCount) {
          const timeBonus = Math.round(state.timeLeft) * SCORE.ringTimeBonusPerSecond;
          this.addScore(timeBonus, 'TIME BONUS');
          this.endFlight(true, 'Every ring threaded — clean run through the dusk.');
        }
        break;
      }
    }
  }

  updateNextTarget() {
    const state = this.missionState;
    let target = null;
    if (this.mission.id === 'rings') {
      const next = this.world.rings.find((ring) => !ring.passed);
      if (next) {
        target = {
          label: `RING ${next.index + 1} OF 8`,
          distance: next.x - this.plane.x,
          altitudeText: `${Math.round(next.y * 3.28)} FT`,
        };
      }
    } else if (this.mission.id === 'hop') {
      const expected = [1, 2, 3][state.nextStripIndex];
      const runway = this.world.runways[expected];
      if (runway) {
        target = {
          label: runway.name,
          distance: runway.x - this.plane.x,
          altitudeText: `STRIP ${state.nextStripIndex + 1} OF 3`,
        };
      }
    } else if (this.mission.id === 'storm') {
      const runway = this.world.runways[3];
      target = {
        label: runway.name,
        distance: runway.x - this.plane.x,
        altitudeText: 'CARGO ABOARD',
      };
    }
    if (target) {
      const screenX = (target.distance) * this.camera.scale;
      target.offScreen = Math.abs(screenX) > VIEW_WIDTH * 0.42;
      target.direction = target.distance >= 0 ? 1 : -1;
      target.distance = Math.abs(target.distance);
    }
    state.nextTarget = target;
  }

  endFlight(success, headline) {
    const state = this.missionState;
    if (success) {
      state.score += SCORE.missionCompleteBonus;
      this.events.push(`MISSION BONUS  +${SCORE.missionCompleteBonus}`);
    } else {
      this.sound.crashNoise();
    }
    this.result = {
      success,
      headline,
      lines: this.events.length ? this.events.slice() : ['No score yet — fly the mission.'],
      score: state.score,
    };
    this.mode = success ? 'complete' : 'crashed';
    this.camera.shakeX = 0;
    this.camera.shakeY = 0;
  }

  currentWarnings() {
    const warnings = [];
    const plane = this.plane;
    if (this.mode !== 'flying') return warnings;
    if (plane.speed < PLANE.minSpeed && !plane.onGround) warnings.push('STALL — NOSE DOWN, ADD POWER');
    if (plane.speed > PLANE.maxSpeed) warnings.push('OVERSPEED — THROTTLE BACK');
    if (plane.fuel > 0 && plane.fuel < 20) warnings.push('LOW FUEL');
    if (plane.fuel <= 0) warnings.push('FUEL EMPTY — GLIDING');
    const aheadGround = this.world.terrainHeightAt(plane.x + 320);
    if (!plane.onGround && plane.verticalSpeed < -4 && aheadGround > plane.y - 70) {
      warnings.push('PULL UP');
    }
    if (this.mission.id === 'storm' && this.world.gustAt(plane.x) && !plane.onGround) {
      warnings.push('GUSTS — RIDE THEM, DO NOT FIGHT THEM');
    }
    return warnings;
  }

  handleMenuInput() {
    const input = this.input;
    if (this.mode === 'title') {
      for (const mission of MISSIONS) {
        if (input.wasPressed(mission.key)) {
          this.mission = mission;
          this.mode = 'briefing';
          this.sound.ensure();
          return;
        }
      }
      if (input.mouseClicked) {
        const cardWidth = 330;
        const gap = 26;
        const total = MISSIONS.length * cardWidth + (MISSIONS.length - 1) * gap;
        const startX = (VIEW_WIDTH - total) / 2;
        MISSIONS.forEach((mission, index) => {
          const x = startX + index * (cardWidth + gap);
          if (input.mouseX >= x && input.mouseX <= x + cardWidth
            && input.mouseY >= 280 && input.mouseY <= 450) {
            this.mission = mission;
            this.mode = 'briefing';
            this.sound.ensure();
          }
        });
      }
      return;
    }
    if (this.mode === 'briefing') {
      if (input.wasPressed('enter', ' ')) this.startMission(this.mission);
      if (input.wasPressed('escape')) this.mode = 'title';
      return;
    }
    if (this.mode === 'paused') {
      if (input.wasPressed('p', 'escape')) this.mode = 'flying';
      if (input.wasPressed('r')) this.startMission(this.mission);
      return;
    }
    if (this.mode === 'complete' || this.mode === 'crashed') {
      if (input.wasPressed('r')) this.startMission(this.mission);
      if (input.wasPressed('escape', 'enter')) this.mode = 'title';
      for (const mission of MISSIONS) {
        if (input.wasPressed(mission.key)) this.startMission(mission);
      }
    }
  }

  step(dt) {
    this.time += dt;
    if (this.shotScene) return; // frozen scene: no simulation, no input
    const input = this.input;

    if (input.wasPressed('m')) {
      const muted = this.sound.toggleMute();
      this.showToast(muted ? 'SOUND OFF' : 'SOUND ON', 1.5);
    }
    if (this.mode === 'flying') {
      if (input.wasPressed('p')) {
        this.mode = 'paused';
        this.sound.updateIdle();
      } else if (input.wasPressed('r')) {
        this.startMission(this.mission);
      } else if (input.wasPressed('escape')) {
        this.mode = 'title';
        this.sound.updateIdle();
      } else if (input.mouseClicked) {
        this.sound.ensure();
      } else {
        this.stepFlight(dt);
      }
      // Takeoff: rolling fast with the nose up lifts off the strip.
      const plane = this.plane;
      if (plane.onGround && plane.speed >= PLANE.takeoffSpeed && plane.pitch > 0.04) {
        plane.onGround = false;
        plane.y = this.world.terrainHeightAt(plane.x) + 4;
        this.showToast('AIRBORNE', 1.5);
      }
      if (plane.onGround && plane.speed > 0) {
        plane.x += plane.speed * KNOTS_TO_MS * GROUND_SPEED_FACTOR * dt;
        plane.x = clamp(plane.x, 60, WORLD_LENGTH - 60);
        plane.y = this.world.terrainHeightAt(plane.x) + 2;
      }
    } else {
      this.handleMenuInput();
      if (this.mode === 'title' || this.mode === 'briefing') {
        // The title screen flies itself: a slow cruise over the islands.
        this.plane.x += 26 * dt;
        if (this.plane.x > WORLD_LENGTH - 1200) this.plane.x = 400;
        this.plane.y = 300 + Math.sin(this.time * 0.25) * 40;
        this.plane.speed = 120;
        this.plane.throttle = 0.45;
        this.plane.pitch = 0.03;
        this.camera.centerX = this.plane.x + 220;
        this.camera.centerAlt = this.plane.y - 70;
        this.sound.updateIdle();
      }
    }

    if (this.toast && this.time > this.toastUntil) this.toast = null;
    this.input.endFrame();
  }

  buildFrame() {
    if (this.shotScene) return this.shotScene;
    const state = this.missionState;
    return {
      mode: this.mode,
      world: this.world,
      plane: this.plane,
      camera: this.camera,
      time: this.time,
      mission: this.mission,
      missions: MISSIONS,
      missionState: {
        objective: state.objective,
        timeLeft: state.timeLeft,
        score: state.score,
        nextTarget: state.nextTarget,
      },
      warnings: this.currentWarnings(),
      toast: this.toast,
      result: this.result,
    };
  }

  run() {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.step(dt);
      renderFrame(this.ctx, this.buildFrame());
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // Shot mode: render one frozen scene from the URL, nothing moves.
  static bootFromUrl(canvas) {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    const seed = Number(params.get('seed') || 1);
    const game = new SenjaFlight(canvas);
    if (shot) {
      const scene = buildShotScene(shot, seed);
      game.shotScene = {
        ...scene,
        missions: MISSIONS,
        result: scene.result || null,
      };
      document.title = `Senja Flight — ${scene.name}`;
    }
    return game;
  }
}

const canvas = document.getElementById('game');
const game = SenjaFlight.bootFromUrl(canvas);
game.run();
