// main.ts — the entrypoint that hands Solmar Bay in (Node 22, standard
// library only). The game is plain static files under game/, so this program
// only has to do three things: copy game/ and screenshots/ beside this file
// into /output, then write /output/dossier.json with the vendored make.fun
// library's buildDossier, so the judge can read the game. Outside the
// grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Solmar Bay itself needs no build step: serve game/ with `node serve.ts`
// and open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps match the gate's own limits (see the kit's RULES.txt): the game
// stays under 993 files and 48 MiB, screenshots at most 4 and 256 KiB each,
// and the dossier text at most 160 KiB — anything over would be refused
// by the scorer, so refusing here first keeps a bad build loud and local.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
