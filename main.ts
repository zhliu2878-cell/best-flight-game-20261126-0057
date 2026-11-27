// Aurora Run — hand-in program.
//
// Copies game/ and screenshots/ from this repository into the output
// directory and writes dossier.json there with buildDossier from the
// kit's vendor/makefun-game.ts. Node 22/24, standard library only.
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Outside the grader MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The competition's caps for the dossier build.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function main(): void {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
  const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

  const gameSrc = join(repoRoot, 'game');
  const shotsSrc = join(repoRoot, 'screenshots');
  if (!existsSync(gameSrc)) throw new Error(`game/ not found beside main.ts: ${gameSrc}`);
  if (!existsSync(shotsSrc)) throw new Error(`screenshots/ not found beside main.ts: ${shotsSrc}`);

  // Fresh output: clear any previous hand-in so stale files never ship.
  // Clear the directory's contents, never the directory itself: in the
  // grader /output is a mounted volume, and removing the mount point
  // itself fails with EBUSY ("Device or resource busy").
  mkdirSync(outDir, { recursive: true });
  for (const entry of readdirSync(outDir)) {
    rmSync(join(outDir, entry), { recursive: true, force: true });
  }

  // Copy the game and its screenshots into the output directory.
  cpSync(gameSrc, join(outDir, 'game'), { recursive: true });
  cpSync(shotsSrc, join(outDir, 'screenshots'), { recursive: true });

  // Build the dossier from the copied tree and write it alongside.
  const dossier = buildDossier(outDir, CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);

  // Verify what shipped: the game tree, the screenshots and the dossier.
  const gameFiles = readdirSync(join(outDir, 'game'), { recursive: true });
  const shotFiles = readdirSync(join(outDir, 'screenshots'))
    .filter((n) => !n.startsWith('.'))
    .map((n) => ({ name: n, bytes: statSync(join(outDir, 'screenshots', n)).size }));
  console.log(`Aurora Run handed in to ${outDir}`);
  console.log(`game/: ${gameFiles.length} entries`);
  for (const s of shotFiles) console.log(`screenshots/${s.name}: ${s.bytes} bytes`);
  console.log(`dossier.json: ${dossier.length} bytes`);
}

main();
