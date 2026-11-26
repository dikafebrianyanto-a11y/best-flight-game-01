# Senja Flight

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/dikafebrianyanto-a11y/best-flight-game-01/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/dikafebrianyanto-a11y/best-flight-game-01/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A bush pilot at dusk. Fly a small prop plane — Senja Air's PK-SEN — between
island airstrips as the sun goes down over the sea: throttle and pitch on the
stick, fuel in the tanks, and three sorties that each ask for a different kind
of flying.

- **Ring Run** — thread 8 glowing rings against a 150-second clock.
- **Island Hop** — land on three airstrips in order; soft, slow and level wins.
- **Storm Delivery** — carry medical cargo to Pulau Timur through gust bands
  that shove the plane around, and land with fuel to spare.

Stall if you fly too slow, shake apart if you fly too fast, and mind the
hillside on final. The HUD shows altitude, speed, heading, vertical speed,
throttle, fuel, damage, an artificial horizon and the next waypoint — all lit
for dusk flying.

## Run it

Node 22 and a desktop browser, nothing else:

```sh
node serve.ts
```

Then open http://localhost:8080/ and fly.

## Controls

| Key | Does |
| --- | --- |
| W/S or ↑/↓ | Throttle up / down |
| A/D or ←/→ | Pitch up / down |
| Q/E | Bank left / right |
| Mouse | Move to steer pitch |
| 1 / 2 / 3 | Pick a mission |
| Enter | Start the mission |
| P | Pause |
| M | Mute |
| R | Retry the mission |
| Esc | Back to the title screen |

## Screenshots

The game has a deterministic shot mode for its screenshots:
`?shot=cover&seed=1`, `?shot=rings&seed=1`, `?shot=landing&seed=1`,
`?shot=cockpit&seed=1` — each renders one fixed scene from the game's own
code, listed in `shots.json`.

## How it is built

Pure HTML5 canvas and WebAudio, no libraries, no network requests, no
assets but code. The source is split by job: `src/config.js` (numbers),
`src/random.js` (seeded RNG), `src/world.js` (archipelago, runways, rings,
gusts), `src/input.js` (keyboard and mouse), `src/audio.js` (engine hum and
wind), `src/render.js` (sky, sea, terrain, plane and HUD), `src/shots.js`
(the four frozen screenshot scenes) and `src/main.js` (loop, physics and
missions). `main.ts` copies `game/` and `screenshots/` into the output
directory and writes `dossier.json` with the kit's `buildDossier`.
