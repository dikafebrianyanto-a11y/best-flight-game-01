// main.ts — Senja Flight entry program (Node 22, standard library only).
//
// Hands the game in: copies game/ and screenshots/ from beside this file
// into the output directory (MAKEFUN_OUTPUT_DIR, else /output) and writes
// dossier.json there with buildDossier from the kit's vendored library.
//
// The output directory is a mounted volume on the grader, so this program
// never deletes it: it only clears stale files *inside* its game/ and
// screenshots/ children, then copies the fresh files in. Two runs write
// byte-identical output: directory listings are sorted and dossier.json
// comes from buildDossier alone.

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// The gate's caps, restated so the dossier is built against the same
// limits the sealed scorer checks: 160 KiB of source text, at most four
// screenshots of 256 KiB, at most 993 game files totalling 48 MiB.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function clearChildren(dir: string): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    rmSync(join(dir, name), { recursive: true, force: true });
  }
}

function copyTreeSorted(srcDir: string, destDir: string): void {
  mkdirSync(destDir, { recursive: true });
  const names = readdirSync(srcDir).sort();
  for (const name of names) {
    const src = join(srcDir, name);
    const dest = join(destDir, name);
    if (statSync(src).isDirectory()) {
      copyTreeSorted(src, dest);
    } else if (statSync(src).isFile()) {
      copyFileSync(src, dest);
    }
  }
}

function main(): void {
  const gameOut = join(OUT, 'game');
  const shotsOut = join(OUT, 'screenshots');
  mkdirSync(gameOut, { recursive: true });
  mkdirSync(shotsOut, { recursive: true });
  clearChildren(gameOut);
  clearChildren(shotsOut);
  copyTreeSorted(join(HERE, 'game'), gameOut);
  copyTreeSorted(join(HERE, 'screenshots'), shotsOut);
  const dossier = buildDossier(OUT, CAPS);
  writeFileSync(join(OUT, 'dossier.json'), dossier);
}

main();
