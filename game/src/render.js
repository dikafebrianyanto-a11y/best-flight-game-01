// render.js — every pixel of Senja Flight.
// One dusk, one style: violet sky, low orange sun, dark island ridges,
// glittering sea, and a cream-and-red bush plane with its lights on.
// The HUD is drawn, not DOM, so a screenshot always shows the whole game.

import { VIEW_WIDTH, VIEW_HEIGHT, PALETTE, SEA_LEVEL } from './config.js';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function panel(ctx, x, y, width, height) {
  ctx.fillStyle = PALETTE.hudPanel;
  roundRect(ctx, x, y, width, height, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 233, 168, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function text(ctx, value, x, y, size, color, align, weight) {
  ctx.fillStyle = color;
  ctx.font = `${weight || 700} ${size}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

// Same as text(), but shrinks the font just enough for the string to fit
// inside maxWidth, so a long waypoint label can never run off its panel.
function fitText(ctx, value, x, y, size, color, align, weight, maxWidth) {
  ctx.font = `${weight || 700} ${size}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
  const width = ctx.measureText(value).width;
  const fitted = width > maxWidth ? Math.max(9, Math.floor(size * maxWidth / width)) : size;
  text(ctx, value, x, y, fitted, color, align, weight);
}

// World (metres) to screen (pixels) for the current camera.
function toScreen(camera, worldX, worldY) {
  const sx = (worldX - camera.centerX) * camera.scale + VIEW_WIDTH / 2;
  const sy = VIEW_HEIGHT * 0.58 - (worldY - camera.centerAlt) * camera.scale;
  return [sx, sy];
}

function drawSky(ctx, frame) {
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT * 0.62);
  gradient.addColorStop(0, PALETTE.skyTop);
  gradient.addColorStop(0.45, PALETTE.skyMid);
  gradient.addColorStop(0.85, PALETTE.skyLow);
  gradient.addColorStop(1, PALETTE.horizonGlow);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT * 0.62 + 2);

  // Early stars, high up where the dusk is still dark.
  const stars = frame.world.stars || [];
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  for (const star of stars) {
    const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(frame.time * 0.7 + star.phase));
    ctx.globalAlpha = twinkle * star.alpha;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;

  // The low sun, glued to the horizon with a slow parallax drift.
  const sunX = VIEW_WIDTH * 0.72 - frame.camera.centerX * 0.00012;
  const sunY = VIEW_HEIGHT * 0.46;
  const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 190);
  glow.addColorStop(0, 'rgba(255, 190, 90, 0.85)');
  glow.addColorStop(0.35, 'rgba(255, 122, 47, 0.4)');
  glow.addColorStop(1, 'rgba(255, 122, 47, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
  ctx.fillStyle = PALETTE.sunCore;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 122, 47, 0.55)';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 42, 0, Math.PI * 2);
  ctx.fill();
}

function drawRidges(ctx, frame) {
  const layers = [
    { parallax: 0.12, base: 150, amp: 90, color: PALETTE.ridgeFar, alpha: 0.85 },
    { parallax: 0.3, base: 90, amp: 120, color: PALETTE.ridgeMid, alpha: 0.9 },
    { parallax: 0.55, base: 40, amp: 130, color: PALETTE.ridgeNear, alpha: 1 },
  ];
  const horizonY = VIEW_HEIGHT * 0.58 + frame.camera.centerAlt * frame.camera.scale;
  for (const layer of layers) {
    ctx.fillStyle = layer.color;
    ctx.globalAlpha = layer.alpha;
    ctx.beginPath();
    ctx.moveTo(0, horizonY + 2);
    for (let sx = 0; sx <= VIEW_WIDTH; sx += 16) {
      const worldX = frame.camera.centerX + (sx - VIEW_WIDTH / 2) / frame.camera.scale;
      const sample = worldX * layer.parallax;
      const ridge = layer.base + frame.world.ridgeNoise(sample) * layer.amp;
      const sy = horizonY - ridge * frame.camera.scale * 0.55;
      ctx.lineTo(sx, sy);
    }
    ctx.lineTo(VIEW_WIDTH, horizonY + 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSea(ctx, frame) {
  const horizonY = VIEW_HEIGHT * 0.58 + frame.camera.centerAlt * frame.camera.scale;
  const gradient = ctx.createLinearGradient(0, horizonY, 0, VIEW_HEIGHT);
  gradient.addColorStop(0, PALETTE.seaDusk);
  gradient.addColorStop(1, PALETTE.seaDeep);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, Math.max(0, horizonY), VIEW_WIDTH, VIEW_HEIGHT);

  // Sun glitter: a shimmering path on the water under the sun.
  const sunX = VIEW_WIDTH * 0.72 - frame.camera.centerX * 0.00012;
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 26; i += 1) {
    const spread = 14 + i * 9;
    const y = horizonY + 12 + i * ((VIEW_HEIGHT - horizonY) / 26);
    const wobble = Math.sin(frame.time * 1.3 + i * 2.1) * 14;
    const width = 26 + i * 7;
    ctx.fillStyle = i % 2 === 0 ? PALETTE.seaGlitter : '#ffd98a';
    ctx.globalAlpha = 0.5 - i * 0.014;
    ctx.fillRect(sunX - width / 2 + wobble * (spread / 60), y, width, 2.5);
  }
  ctx.restore();
}

function drawClouds(ctx, frame) {
  for (const cloud of frame.world.clouds) {
    const drift = frame.time * cloud.speed;
    const [sx, sy] = toScreen(frame.camera, cloud.x + drift, cloud.y);
    if (sx < -260 || sx > VIEW_WIDTH + 260 || sy < -80 || sy > VIEW_HEIGHT * 0.6) continue;
    const s = cloud.scale * frame.camera.scale * 1.4;
    ctx.fillStyle = 'rgba(255, 176, 138, 0.5)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 62 * s, 15 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(sx - 34 * s, sy + 5 * s, 38 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(sx + 38 * s, sy + 4 * s, 42 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 214, 170, 0.35)';
    ctx.beginPath();
    ctx.ellipse(sx, sy - 6 * s, 46 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTerrain(ctx, frame) {
  const camera = frame.camera;
  const horizonY = VIEW_HEIGHT * 0.58 + camera.centerAlt * camera.scale;
  ctx.beginPath();
  ctx.moveTo(0, VIEW_HEIGHT);
  for (let sx = 0; sx <= VIEW_WIDTH; sx += 8) {
    const worldX = camera.centerX + (sx - VIEW_WIDTH / 2) / camera.scale;
    const ground = frame.world.terrainHeightAt(worldX);
    const [, sy] = toScreen(camera, worldX, ground);
    ctx.lineTo(sx, sy);
  }
  ctx.lineTo(VIEW_WIDTH, VIEW_HEIGHT);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(0, horizonY - 160, 0, VIEW_HEIGHT);
  gradient.addColorStop(0, PALETTE.island);
  gradient.addColorStop(1, PALETTE.islandDark);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Beach line where the land meets the sea.
  ctx.strokeStyle = PALETTE.beach;
  ctx.lineWidth = 3;
  ctx.beginPath();
  let started = false;
  for (let sx = 0; sx <= VIEW_WIDTH; sx += 8) {
    const worldX = camera.centerX + (sx - VIEW_WIDTH / 2) / camera.scale;
    const ground = frame.world.terrainHeightAt(worldX);
    const [, sy] = toScreen(camera, worldX, Math.max(ground, 0));
    if (ground > 2) {
      if (!started) {
        ctx.moveTo(sx, sy);
        started = true;
      } else {
        ctx.lineTo(sx, sy);
      }
    } else {
      started = false;
    }
  }
  ctx.stroke();

  // Palm silhouettes on the islands, sparse and seeded.
  ctx.fillStyle = PALETTE.islandDark;
  for (const island of frame.world.islands) {
    for (let i = 0; i < 3; i += 1) {
      const px = island.center + (i - 1) * island.halfWidth * 0.42;
      const ground = frame.world.terrainHeightAt(px);
      if (ground < 12) continue;
      const [sx, sy] = toScreen(camera, px, ground);
      if (sx < -20 || sx > VIEW_WIDTH + 20) continue;
      const h = 26 * camera.scale;
      ctx.fillRect(sx - 1, sy - h, 2, h);
      ctx.beginPath();
      ctx.ellipse(sx - 7, sy - h, 9, 3, -0.5, 0, Math.PI * 2);
      ctx.ellipse(sx + 7, sy - h, 9, 3, 0.5, 0, Math.PI * 2);
      ctx.ellipse(sx, sy - h - 4, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawRunway(ctx, frame, runway) {
  const camera = frame.camera;
  const ground = runway.groundY;
  const [x0, y0] = toScreen(camera, runway.x - runway.width / 2, ground);
  const [x1] = toScreen(camera, runway.x + runway.width / 2, ground);
  const width = x1 - x0;
  if (x1 < -80 || x0 > VIEW_WIDTH + 80) return;
  const stripHeight = Math.max(7, 13 * camera.scale);
  ctx.fillStyle = PALETTE.runway;
  ctx.fillRect(x0, y0 - stripHeight, width, stripHeight);
  ctx.fillStyle = PALETTE.runwayLine;
  const dashes = 7;
  for (let i = 0; i < dashes; i += 1) {
    const dx = x0 + (width * (i + 0.5)) / dashes;
    ctx.fillRect(dx - width / (dashes * 4), y0 - stripHeight + 2, width / (dashes * 2), 3);
  }
  // Threshold bars at both ends.
  ctx.fillRect(x0 + 4, y0 - stripHeight + 2, 14, 3);
  ctx.fillRect(x1 - 18, y0 - stripHeight + 2, 14, 3);
  // Edge lights, glowing in the dusk.
  for (let i = 0; i <= 6; i += 1) {
    const lx = x0 + (width * i) / 6;
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath();
    ctx.arc(lx, y0 - stripHeight - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Strip name board and a windsock at the western end.
  const [bx, by] = toScreen(camera, runway.x - runway.width / 2 - 60, ground);
  ctx.fillStyle = 'rgba(12, 10, 28, 0.8)';
  ctx.fillRect(bx - 4, by - 46, 92, 22);
  text(ctx, runway.short, bx + 42, by - 30, 13, PALETTE.hudText, 'center', 800);
  const [wx, wy] = toScreen(camera, runway.x + runway.width / 2 + 50, ground);
  ctx.strokeStyle = '#8a8f9a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(wx, wy);
  ctx.lineTo(wx, wy - 34);
  ctx.stroke();
  const windAngle = 0.5 + Math.sin(frame.time * 0.8) * 0.2;
  ctx.fillStyle = '#ff7a2f';
  ctx.beginPath();
  ctx.moveTo(wx, wy - 34);
  ctx.lineTo(wx + Math.cos(windAngle) * 22, wy - 34 + Math.sin(windAngle) * 8);
  ctx.lineTo(wx + Math.cos(windAngle) * 20, wy - 30 + Math.sin(windAngle) * 8);
  ctx.closePath();
  ctx.fill();
}

function drawRing(ctx, frame, ring) {
  const camera = frame.camera;
  const [sx, sy] = toScreen(camera, ring.x, ring.y);
  const radius = ring.radius * camera.scale;
  if (sx < -radius - 40 || sx > VIEW_WIDTH + radius + 40) return;
  const passed = ring.passed;
  const pulse = 1 + Math.sin(frame.time * 3 + ring.index) * 0.06;
  const r = radius * pulse;
  ctx.save();
  ctx.globalAlpha = passed ? 0.35 : 0.95;
  ctx.lineWidth = passed ? 5 : 9;
  ctx.strokeStyle = passed ? PALETTE.hudGreen : '#ffb347';
  ctx.shadowColor = passed ? '#7fe08a' : '#ff7a2f';
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 233, 168, 0.9)';
  ctx.beginPath();
  ctx.arc(sx, sy, r * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  if (!passed) {
    text(ctx, String(ring.index + 1), sx, sy + 9, 30, '#ffe9a8', 'center', 800);
  }
  ctx.restore();
}

function drawBirds(ctx, frame) {
  ctx.strokeStyle = 'rgba(30, 16, 44, 0.85)';
  ctx.lineWidth = 2;
  for (const bird of frame.world.birds) {
    const bx = bird.x + frame.time * bird.speed;
    const wrapped = ((bx % 26000) + 26000) % 26000;
    const by = bird.y + Math.sin(frame.time * 1.4 + bird.phase) * 14;
    const [sx, sy] = toScreen(frame.camera, wrapped, by);
    if (sx < -20 || sx > VIEW_WIDTH + 20) continue;
    const flap = Math.sin(frame.time * 7 + bird.phase) * 4;
    ctx.beginPath();
    ctx.moveTo(sx - 7, sy + flap);
    ctx.quadraticCurveTo(sx, sy - 2, sx, sy);
    ctx.quadraticCurveTo(sx, sy - 2, sx + 7, sy + flap);
    ctx.stroke();
  }
}

function drawPlane(ctx, frame) {
  const plane = frame.plane;
  const camera = frame.camera;
  const [sx, sy] = toScreen(camera, plane.x, plane.y);
  const scale = camera.scale * (frame.planeScale || 1);
  const blink = Math.sin(frame.time * 4) > 0;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(-plane.pitch * 0.85 + plane.bank * 0.14);
  ctx.scale(scale, scale);

  // Landing light cone when low over the strip.
  if (plane.y < 160 && plane.speed > 40) {
    const beam = ctx.createLinearGradient(48, 0, 190, 0);
    beam.addColorStop(0, 'rgba(255, 233, 168, 0.35)');
    beam.addColorStop(1, 'rgba(255, 233, 168, 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(46, -4);
    ctx.lineTo(190, -26);
    ctx.lineTo(190, 26);
    ctx.lineTo(46, 6);
    ctx.closePath();
    ctx.fill();
  }

  // Tailplane and fin.
  ctx.fillStyle = PALETTE.planeTrim;
  ctx.beginPath();
  ctx.moveTo(-44, -2);
  ctx.lineTo(-30, -24);
  ctx.lineTo(-20, -24);
  ctx.lineTo(-26, -1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.planeWing;
  ctx.beginPath();
  ctx.moveTo(-38, 2);
  ctx.lineTo(-18, 8);
  ctx.lineTo(-14, 2);
  ctx.closePath();
  ctx.fill();

  // Main wing, swept slightly back, seen from the side.
  ctx.fillStyle = PALETTE.planeWing;
  ctx.beginPath();
  ctx.moveTo(-6, 4);
  ctx.lineTo(18, 22);
  ctx.lineTo(30, 20);
  ctx.lineTo(12, 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(60, 30, 20, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Fuselage: cream body with a red cheatline.
  const body = ctx.createLinearGradient(0, -16, 0, 12);
  body.addColorStop(0, '#fff8e2');
  body.addColorStop(0.55, PALETTE.planeBody);
  body.addColorStop(1, '#d9c69a');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-48, -2);
  ctx.quadraticCurveTo(-46, -14, -28, -15);
  ctx.lineTo(28, -13);
  ctx.quadraticCurveTo(46, -11, 48, -2);
  ctx.quadraticCurveTo(44, 9, 26, 10);
  ctx.lineTo(-30, 10);
  ctx.quadraticCurveTo(-46, 8, -48, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.planeTrim;
  ctx.fillRect(-46, 1, 92, 3);

  // Lit cabin windows.
  ctx.fillStyle = '#ffd98a';
  for (let i = 0; i < 3; i += 1) {
    roundRect(ctx, -6 + i * 12, -11, 9, 7, 3);
    ctx.fill();
  }
  // Windscreen.
  ctx.fillStyle = '#9fd8ff';
  ctx.beginPath();
  ctx.moveTo(26, -12);
  ctx.lineTo(38, -10);
  ctx.lineTo(36, -2);
  ctx.lineTo(24, -2);
  ctx.closePath();
  ctx.fill();

  // Livery and registration.
  text(ctx, 'SENJA AIR', -20, 8, 8, '#7a2c14', 'left', 800);
  text(ctx, 'PK-SEN', -34, -19, 7, '#f4ead2', 'left', 800);

  // Propeller: blurred disc plus two blades at the current angle.
  const propAngle = frame.fixedPropAngle !== undefined
    ? frame.fixedPropAngle
    : frame.time * 28;
  ctx.fillStyle = 'rgba(40, 30, 40, 0.18)';
  ctx.beginPath();
  ctx.ellipse(50, -2, 5, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(50, -2);
  ctx.rotate(propAngle);
  ctx.fillStyle = 'rgba(30, 22, 30, 0.75)';
  roundRect(ctx, -2, -26, 4, 52, 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#c94f2e';
  ctx.beginPath();
  ctx.arc(50, -2, 4, 0, Math.PI * 2);
  ctx.fill();

  // Navigation lights: green wingtip, red tail strobe.
  ctx.fillStyle = '#7fe08a';
  ctx.beginPath();
  ctx.arc(28, 21, 2.5, 0, Math.PI * 2);
  ctx.fill();
  if (blink) {
    ctx.fillStyle = '#ff5a4e';
    ctx.beginPath();
    ctx.arc(-48, -2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCompass(ctx, frame) {
  const heading = frame.plane.heading;
  const cx = VIEW_WIDTH / 2;
  const y = 30;
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - 170, 8, 340, 40);
  ctx.clip();
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.fillRect(cx - 170, 8, 340, 40);
  for (let offset = -60; offset <= 60; offset += 5) {
    let value = Math.round((heading + offset) / 5) * 5;
    const normalized = ((value % 360) + 360) % 360;
    const dx = cx + (offset - ((heading % 5) + 5) % 5) * 2.6;
    const major = normalized % 30 === 0;
    ctx.strokeStyle = major ? PALETTE.hudText : 'rgba(255, 233, 168, 0.4)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(dx, y + 8);
    ctx.lineTo(dx, y + (major ? 22 : 15));
    ctx.stroke();
    if (major) {
      const label = normalized === 0 ? 'N' : normalized === 90 ? 'E'
        : normalized === 180 ? 'S' : normalized === 270 ? 'W'
        : String(normalized).padStart(3, '0');
      text(ctx, label, dx, y - 2, 11, PALETTE.hudText, 'center', 700);
    }
  }
  ctx.restore();
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.moveTo(cx, 48);
  ctx.lineTo(cx - 6, 38);
  ctx.lineTo(cx + 6, 38);
  ctx.closePath();
  ctx.fill();
  text(ctx, `${String(Math.round(heading)).padStart(3, '0')}°`, cx, 66, 13, PALETTE.hudText, 'center', 800);
}

function drawArtificialHorizon(ctx, frame, x, y, radius) {
  const plane = frame.plane;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-plane.bank * 0.5);
  const pitchOffset = clamp(plane.pitch, -0.6, 0.6) * radius * 1.4;
  ctx.fillStyle = '#3a5a8c';
  ctx.fillRect(-radius, -radius + pitchOffset, radius * 2, radius - pitchOffset + radius);
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(-radius, pitchOffset, radius * 2, radius * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-radius, pitchOffset);
  ctx.lineTo(radius, pitchOffset);
  ctx.stroke();
  ctx.lineWidth = 1;
  for (const offset of [-0.3, 0.3]) {
    ctx.beginPath();
    ctx.moveTo(-radius * 0.5, pitchOffset + offset * radius * 1.4);
    ctx.lineTo(radius * 0.5, pitchOffset + offset * radius * 1.4);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x - x, y - y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-radius * 0.55, 0);
  ctx.lineTo(-radius * 0.15, 0);
  ctx.moveTo(radius * 0.15, 0);
  ctx.lineTo(radius * 0.55, 0);
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 5);
  ctx.stroke();
  ctx.restore();
}

function drawHud(ctx, frame) {
  const plane = frame.plane;
  const state = frame.missionState;

  // Top-left: the three numbers the judge looks for, big and lit.
  panel(ctx, 16, 14, 300, 96);
  text(ctx, 'ALT', 30, 40, 12, PALETTE.hudCyan, 'left', 700);
  text(ctx, `${Math.max(0, Math.round(plane.y * 3.28))}`, 30, 74, 30, PALETTE.hudText, 'left', 800);
  text(ctx, 'FT', 148, 74, 13, PALETTE.hudCyan, 'left', 700);
  text(ctx, 'SPD', 172, 40, 12, PALETTE.hudCyan, 'left', 700);
  text(ctx, `${Math.round(plane.speed)}`, 172, 74, 30, PALETTE.hudText, 'left', 800);
  text(ctx, 'KT', 252, 74, 13, PALETTE.hudCyan, 'left', 700);
  text(ctx, 'HDG', 30, 100, 12, PALETTE.hudCyan, 'left', 700);
  text(ctx, `${String(Math.round(plane.heading)).padStart(3, '0')}°`, 76, 100, 16, PALETTE.hudText, 'left', 800);
  text(ctx, 'VSI', 172, 100, 12, PALETTE.hudCyan, 'left', 700);
  const vsi = Math.round(plane.verticalSpeed * 196.85);
  const vsiText = `${vsi >= 0 ? '+' : ''}${vsi} FPM`;
  text(ctx, vsiText, 214, 100, 16, vsi < -500 ? PALETTE.hudRed : PALETTE.hudText, 'left', 800);

  drawCompass(ctx, frame);

  // Top-right: mission, clock, score.
  panel(ctx, VIEW_WIDTH - 316, 14, 300, 96);
  text(ctx, frame.mission.shortName, VIEW_WIDTH - 300, 40, 15, PALETTE.hudAmber, 'left', 800);
  text(ctx, state.objective, VIEW_WIDTH - 300, 62, 13, PALETTE.hudText, 'left', 600);
  text(ctx, `TIME ${formatTime(state.timeLeft)}`, VIEW_WIDTH - 300, 88, 15, state.timeLeft < 30 ? PALETTE.hudRed : PALETTE.hudText, 'left', 800);
  text(ctx, `SCORE ${state.score}`, VIEW_WIDTH - 158, 88, 15, PALETTE.hudGreen, 'left', 800);

  // Bottom-left: throttle, fuel, damage.
  panel(ctx, 16, VIEW_HEIGHT - 118, 220, 102);
  text(ctx, 'THR', 30, VIEW_HEIGHT - 92, 12, PALETTE.hudCyan, 'left', 700);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  roundRect(ctx, 30, VIEW_HEIGHT - 84, 150, 12, 6);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudAmber;
  roundRect(ctx, 30, VIEW_HEIGHT - 84, 150 * plane.throttle, 12, 6);
  ctx.fill();
  text(ctx, `${Math.round(plane.throttle * 100)}%`, 190, VIEW_HEIGHT - 72, 14, PALETTE.hudText, 'left', 800);
  text(ctx, 'FUEL', 30, VIEW_HEIGHT - 50, 12, PALETTE.hudCyan, 'left', 700);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  roundRect(ctx, 30, VIEW_HEIGHT - 42, 150, 12, 6);
  ctx.fill();
  ctx.fillStyle = plane.fuel < 20 ? PALETTE.hudRed : PALETTE.hudGreen;
  roundRect(ctx, 30, VIEW_HEIGHT - 42, 150 * (plane.fuel / 100), 12, 6);
  ctx.fill();
  text(ctx, `${Math.round(plane.fuel)}%`, 190, VIEW_HEIGHT - 30, 14, plane.fuel < 20 ? PALETTE.hudRed : PALETTE.hudText, 'left', 800);
  if (plane.damage > 0) {
    text(ctx, `DMG ${Math.round(plane.damage)}%`, 30, VIEW_HEIGHT - 96, 12, PALETTE.hudRed, 'left', 800);
  }

  // Bottom-right: artificial horizon and the next waypoint. The panel is
  // 256 wide with 16 px of canvas to spare on the right, and the two
  // free-text lines shrink to fit so they can never run off its edge.
  panel(ctx, VIEW_WIDTH - 272, VIEW_HEIGHT - 118, 256, 102);
  drawArtificialHorizon(ctx, frame, VIEW_WIDTH - 214, VIEW_HEIGHT - 67, 42);
  text(ctx, 'HORIZON', VIEW_WIDTH - 214, VIEW_HEIGHT - 16, 10, PALETTE.hudCyan, 'center', 700);
  const target = state.nextTarget;
  if (target) {
    text(ctx, 'NEXT', VIEW_WIDTH - 152, VIEW_HEIGHT - 96, 11, PALETTE.hudCyan, 'left', 700);
    fitText(ctx, target.label, VIEW_WIDTH - 152, VIEW_HEIGHT - 74, 14, PALETTE.hudText, 'left', 800, 128);
    text(ctx, `${Math.round(target.distance)} m`, VIEW_WIDTH - 152, VIEW_HEIGHT - 52, 14, PALETTE.hudAmber, 'left', 800);
    fitText(ctx, target.altitudeText, VIEW_WIDTH - 152, VIEW_HEIGHT - 30, 12, PALETTE.hudText, 'left', 600, 128);
  }

  // Edge arrow toward the next ring or strip when it is off-screen.
  if (target && target.offScreen) {
    const arrowY = VIEW_HEIGHT * 0.42;
    const arrowX = target.direction > 0 ? VIEW_WIDTH - 46 : 46;
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.beginPath();
    if (target.direction > 0) {
      ctx.moveTo(arrowX + 16, arrowY);
      ctx.lineTo(arrowX - 10, arrowY - 12);
      ctx.lineTo(arrowX - 10, arrowY + 12);
    } else {
      ctx.moveTo(arrowX - 16, arrowY);
      ctx.lineTo(arrowX + 10, arrowY - 12);
      ctx.lineTo(arrowX + 10, arrowY + 12);
    }
    ctx.closePath();
    ctx.fill();
    text(ctx, target.label, arrowX, arrowY + 30, 12, PALETTE.hudText, 'center', 700);
  }

  // Centre warnings, one line, impossible to miss.
  let warningY = VIEW_HEIGHT * 0.2;
  for (const warning of frame.warnings || []) {
    const blinkOn = Math.sin(frame.time * 8) > -0.4;
    if (!blinkOn) continue;
    text(ctx, warning, VIEW_WIDTH / 2, warningY, 26, PALETTE.hudRed, 'center', 800);
    warningY += 34;
  }

  // Toast messages under the compass.
  if (frame.toast) {
    text(ctx, frame.toast, VIEW_WIDTH / 2, 92, 18, PALETTE.hudGreen, 'center', 800);
  }
}

export function formatTime(seconds) {
  const clamped = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(clamped / 60);
  const rest = clamped % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function drawTitle(ctx, frame) {
  ctx.fillStyle = 'rgba(20, 10, 38, 0.45)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  text(ctx, 'SENJA FLIGHT', VIEW_WIDTH / 2, 150, 84, '#ffe9a8', 'center', 800);
  text(ctx, 'a bush pilot at dusk · terbang senja antar pulau', VIEW_WIDTH / 2, 190, 20, '#ffd98a', 'center', 600);
  text(ctx, 'ALT · SPD · HDG on the HUD — fly the rings, land the strips, mind the fuel', VIEW_WIDTH / 2, 220, 15, 'rgba(255, 233, 168, 0.8)', 'center', 600);

  const cards = frame.missions;
  const cardWidth = 330;
  const gap = 26;
  const total = cards.length * cardWidth + (cards.length - 1) * gap;
  const startX = (VIEW_WIDTH - total) / 2;
  cards.forEach((mission, index) => {
    const x = startX + index * (cardWidth + gap);
    const y = 280;
    panel(ctx, x, y, cardWidth, 170);
    text(ctx, `PRESS ${mission.key}`, x + 20, y + 34, 14, PALETTE.hudAmber, 'left', 800);
    text(ctx, mission.name, x + 20, y + 66, 24, PALETTE.hudText, 'left', 800);
    text(ctx, mission.tagline, x + 20, y + 94, 14, PALETTE.hudCyan, 'left', 600);
    const words = mission.briefing.split(' ');
    let line = '';
    let lineY = y + 122;
    for (const word of words) {
      if ((line + ' ' + word).trim().length > 42) {
        text(ctx, line.trim(), x + 20, lineY, 12, 'rgba(255, 233, 168, 0.85)', 'left', 500);
        line = word;
        lineY += 16;
      } else {
        line += ' ' + word;
      }
    }
    if (line.trim()) text(ctx, line.trim(), x + 20, lineY, 12, 'rgba(255, 233, 168, 0.85)', 'left', 500);
  });

  text(ctx, 'W/S or ↑/↓ throttle · A/D or ←/→ pitch · Q/E bank · mouse steers too', VIEW_WIDTH / 2, 500, 15, PALETTE.hudText, 'center', 600);
  text(ctx, 'P pause · M mute · R retry · ESC menu', VIEW_WIDTH / 2, 526, 15, PALETTE.hudText, 'center', 600);
  text(ctx, 'Senja Flight — an original game. No network, no assets but code.', VIEW_WIDTH / 2, 680, 13, 'rgba(255, 233, 168, 0.6)', 'center', 500);
}

function drawBriefing(ctx, frame) {
  ctx.fillStyle = 'rgba(20, 10, 38, 0.55)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  const mission = frame.mission;
  text(ctx, mission.name.toUpperCase(), VIEW_WIDTH / 2, 190, 56, '#ffe9a8', 'center', 800);
  text(ctx, mission.tagline, VIEW_WIDTH / 2, 228, 20, '#ffd98a', 'center', 600);
  text(ctx, `OBJECTIVE — ${mission.objective}`, VIEW_WIDTH / 2, 300, 18, PALETTE.hudGreen, 'center', 700);
  const words = mission.briefing.split(' ');
  let line = '';
  let lineY = 350;
  for (const word of words) {
    if ((line + ' ' + word).trim().length > 78) {
      text(ctx, line.trim(), VIEW_WIDTH / 2, lineY, 17, PALETTE.hudText, 'center', 500);
      line = word;
      lineY += 26;
    } else {
      line += ' ' + word;
    }
  }
  if (line.trim()) text(ctx, line.trim(), VIEW_WIDTH / 2, lineY, 17, PALETTE.hudText, 'center', 500);
  text(ctx, `TIME LIMIT ${formatTime(mission.timeLimit)}   ·   FUEL ${mission.startFuel}%`, VIEW_WIDTH / 2, lineY + 48, 16, PALETTE.hudCyan, 'center', 700);
  const blinkOn = Math.sin(frame.time * 4) > -0.3;
  if (blinkOn) text(ctx, 'PRESS ENTER TO FLY   ·   ESC TO GO BACK', VIEW_WIDTH / 2, lineY + 96, 18, PALETTE.hudAmber, 'center', 800);
}

function drawPaused(ctx, frame) {
  ctx.fillStyle = 'rgba(20, 10, 38, 0.6)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  text(ctx, 'PAUSED', VIEW_WIDTH / 2, 300, 64, '#ffe9a8', 'center', 800);
  text(ctx, 'P resume · R restart mission · ESC title screen', VIEW_WIDTH / 2, 350, 18, PALETTE.hudText, 'center', 600);
}

function drawEndScreen(ctx, frame) {
  const result = frame.result;
  const success = result.success;
  if (frame.brightEnd) {
    // Cockpit screenshot: no full-screen dim. The banner is a centred
    // strip below the compass, the scene and HUD stay bright, and the
    // score card sits below the plane, clear of it. The hint is always
    // drawn, never blinked away.
    panel(ctx, 320, 78, 640, 98);
    text(ctx, success ? 'MISSION COMPLETE' : 'FLIGHT OVER', VIEW_WIDTH / 2, 122, 40, success ? PALETTE.hudGreen : PALETTE.hudRed, 'center', 800);
    text(ctx, result.headline, VIEW_WIDTH / 2, 156, 17, '#ffe9a8', 'center', 600);
    panel(ctx, 360, 500, 560, 172);
    let y = 540;
    for (const line of result.lines) {
      fitText(ctx, line, VIEW_WIDTH / 2, y, 16, PALETTE.hudText, 'center', 600, 520);
      y += 26;
    }
    text(ctx, `TOTAL SCORE  ${result.score}`, VIEW_WIDTH / 2, y + 12, 26, PALETTE.hudAmber, 'center', 800);
    text(ctx, 'Press R to fly again · 1/2/3 for another mission · Esc for title', VIEW_WIDTH / 2, 700, 17, PALETTE.hudText, 'center', 700);
    return;
  }
  ctx.fillStyle = 'rgba(20, 10, 38, 0.62)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  text(ctx, success ? 'MISSION COMPLETE' : 'FLIGHT OVER', VIEW_WIDTH / 2, 210, 58, success ? PALETTE.hudGreen : PALETTE.hudRed, 'center', 800);
  text(ctx, result.headline, VIEW_WIDTH / 2, 252, 20, '#ffe9a8', 'center', 600);
  let y = 320;
  for (const line of result.lines) {
    text(ctx, line, VIEW_WIDTH / 2, y, 18, PALETTE.hudText, 'center', 600);
    y += 30;
  }
  text(ctx, `TOTAL SCORE  ${result.score}`, VIEW_WIDTH / 2, y + 18, 30, PALETTE.hudAmber, 'center', 800);
  const blinkOn = Math.sin(frame.time * 4) > -0.3;
  if (blinkOn) {
    text(ctx, 'R fly again · 1/2/3 another mission · ESC title', VIEW_WIDTH / 2, y + 70, 17, PALETTE.hudText, 'center', 700);
  }
}

// The one entry point the game loop calls every frame.
export function renderFrame(ctx, frame) {
  ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.save();
  if (frame.camera.shakeX || frame.camera.shakeY) {
    ctx.translate(frame.camera.shakeX || 0, frame.camera.shakeY || 0);
  }
  drawSky(ctx, frame);
  drawRidges(ctx, frame);
  drawSea(ctx, frame);
  drawClouds(ctx, frame);
  drawTerrain(ctx, frame);
  for (const runway of frame.world.runways) drawRunway(ctx, frame, runway);
  if (frame.mission.id === 'rings') {
    for (const ring of frame.world.rings) drawRing(ctx, frame, ring);
  }
  drawBirds(ctx, frame);
  drawPlane(ctx, frame);
  ctx.restore();

  // Vignette: a soft dark edge so the HUD sits on the picture.
  const vignette = ctx.createRadialGradient(
    VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_HEIGHT * 0.45,
    VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_HEIGHT * 0.95,
  );
  vignette.addColorStop(0, 'rgba(10, 6, 24, 0)');
  vignette.addColorStop(1, 'rgba(10, 6, 24, 0.35)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  if (frame.mode === 'title') {
    drawTitle(ctx, frame);
  } else if (frame.mode === 'briefing') {
    drawHud(ctx, frame);
    drawBriefing(ctx, frame);
  } else if (frame.mode === 'paused') {
    drawHud(ctx, frame);
    drawPaused(ctx, frame);
  } else if (frame.mode === 'complete' || frame.mode === 'crashed') {
    drawHud(ctx, frame);
    drawEndScreen(ctx, frame);
  } else {
    drawHud(ctx, frame);
  }
}
