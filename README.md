[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Fadliilmi/solmar-bay-2/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Fadliilmi/solmar-bay-2/reward.svg)](https://make.fun/bounty/gta6-01)

# Solmar Bay

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).

You are **Rico Vega**, back in Solmar Bay. Fixer **Tía Carmen** has the work:
six story missions across seven districts, from stealing your first wheels to
the bank job **The Solmar Score**. Steal six kinds of cars, outrun the SBPD
through a living city of traffic and pedestrians, fight rival crews, dodge a
0–5 star wanted level, and hunt 8 hidden Sun Coins worth $250 each.

## Play

Serve `game/` with any static server (for example `node serve.ts`) and open
http://localhost:8080 — no build step, no network at runtime, everything is a
file under `game/`.

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| Mouse + click | Aim, shoot / punch |
| E | Enter or exit a car, interact with shops and services |
| Q | Switch fists / pistol |
| R | Radio Solmar on / off |
| P / Esc | Pause |
| Enter | Start / continue |

City services: **Ammo-Nation** (guns and ammo), **Pay 'n Spray** (lose the
heat), **Solmar General Hospital** (heal up), and your **safehouse** (saves
progress). Progress — cash, coins and missions — is saved in localStorage.

## What is inside

- A seeded city: Downtown, Old Town, Marina, Beachfront, Industrial, Suburbs
  and Palm Park, with a beach, a marina with piers, and a park pond
- Traffic that follows the streets, pedestrians who flee gunfire
- Six stealable cars, each with its own speed and handling
- SBPD patrol cars with sirens and road pursuit, foot officers who arrest
- Six story missions with a tracker, markers and Tía Carmen briefings
- Combat with fists and pistol against armed rival crews
- HUD with live minimap, wanted stars, cash, health and armour, weapon and
  ammo, mission tracker, clock and speedometer
- Day and night cycle: headlights, lit windows, streetlight pools after dark
- Fully synthesized WebAudio sound: engine, two-tone sirens, gunfire and an
  original chiptune station, Radio Solmar

## Layout

- `game/index.html` — the page and canvas
- `game/src/config.js` — districts, cars, missions, coins, tuning
- `game/src/random.js` — seeded random numbers
- `game/src/world.js` — city generation, traffic, pedestrians, collisions
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesized sound and Radio Solmar
- `game/src/render.js` — city, cars, characters, lighting, HUD, minimap
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=…&seed=1`)
- `game/src/main.js` — game loop, player, police, combat, missions, saves
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json`

Everything in Solmar Bay — the city, characters, vehicles, names, story, art,
sounds and music — is original. Nothing is taken from Rockstar Games or any
other commercial game.

MIT licensed. Built by an AI agent for Fadli Ilmi (`@fadli-ilmi`).
