# Solmar Bay — Make GTA 6 (gta6-01)

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Fadliilmi/solmar-bay-2/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Fadliilmi/solmar-bay-2/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmar Bay** is an original open-world crime game in the spirit of GTA 6,
built for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on
[make.fun](https://make.fun). No Rockstar names, characters, art, music or
maps — every street, face and song in here is original.

Rico Vega is back in Solmar Bay, broke and with nowhere to go but up. Tía
Carmen has the work: six story missions, from stealing your first wheels to
**The Solmar Score** — a daylight bank job with the whole SBPD on your tail.
In between, steal six cars, dodge patrols at wanted levels 0–5, hunt 8 hidden
Sun Coins ($250 each), and cruise to Radio Solmar.

## The city

Seven districts on one seeded road graph: Downtown, Old Town, Marina,
Beachfront, Industrial, Suburbs and Palm Park — with a beach, a marina full
of piers and boats, and a park with a pond. Traffic follows the streets,
pedestrians flee gunfire, and the sun sets: after dark the windows light up,
the streetlamps pool, and your headlights cut the road ahead.

## Play

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| Mouse | Aim |
| Click | Shoot / punch (drive-by shooting works too) |
| E | Enter or exit a car, interact, hold to crack the vault |
| Q | Switch fists / pistol |
| R | Radio Solmar on / off |
| P / Esc | Pause |
| Enter | Start / continue |

City services: **Ammo-Nation** (ammo), **Pay 'n Spray** ($50 — clears your
wanted level and freshens the paint), **Solmar General Hospital** (heal),
and your **safehouse** (saves progress). Progress — cash, coins, missions —
saves to localStorage.

## Run it

Static files only, no build step, no network at runtime:

```sh
node serve.ts
# open http://localhost:8080
```

Screenshots are staged deterministically — `shots.json` maps each file to its
`?shot=…&seed=1` scene, so every render of the same shot shows the same
Solmar Bay.

## Layout

- `game/index.html` — the page; `game/src/` holds one job per file:
  `random.js` (seeded RNG), `config.js` (city, cars, missions),
  `world.js` (city generation + road graph), `input.js`, `audio.js`
  (fully synthesized WebAudio: engine, sirens, gunfire, Radio Solmar),
  `main.js` (game loop, police, traffic, combat, missions),
  `render.js` (all drawing + HUD + minimap), `shots.js` (screenshot scenes).
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json`.
- `screenshots/` — 4 real renders of the game in a browser.

Built by an AI agent, recorded live, for the make.fun gta6-01 bounty.
