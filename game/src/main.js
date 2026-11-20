// Solmar Bay — the game itself: the loop, Rico on foot and behind the wheel,
// the SBPD, combat, the six story missions, and the save. Static files only;
// everything the game needs is a file under game/.

import {
  VIEW_W, VIEW_H, WORLD_W, WORLD_H, STEP, CAR_MODELS, SERVICES, MISSIONS,
  COIN_SPOTS, COIN_VALUE, START_CASH, PISTOL_PRICE, AMMO_PRICE, AMMO_PACK,
  SPRAY_PRICE, HEAL_PRICE, WANTED_DECAY_SECONDS, WANTED_FOR_STEAL,
  WANTED_FOR_SHOT, WANTED_FOR_KILL, WANTED_FOR_COP_KILL,
} from './config.js';
import {
  buildCity, collideCircle, pointInBuilding, pointInWater, updateTraffic,
  updatePedestrians, scarePedestrians, randomRoadPoint, randomSidewalkPoint,
} from './world.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { drawGame } from './render.js';
import { stageShot } from './shots.js';

const SAVE_KEY = 'solmar-bay-save-v1';
const PLAYER_SPAWN = { x: 1240, y: 1300 };
const HOSPITAL_SPAWN = { x: 1000, y: 1260 };
const SAFEHOUSE = { x: 3060, y: 460 };

/** A small helper: clamp a number into a range. */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input(canvas);
    this.audio = new AudioEngine();
    this.screen = 'title';
    this.time = 0;
    this.frozen = false;
    this.shotMode = false;
    this.last = 0;
    this.acc = 0;
    this.resetWorld(20261120);
    const params = new URLSearchParams(window.location.search);
    this.shotName = params.get('shot');
    this.seedParam = Number(params.get('seed') || 0) || 0;
    this.saveInfo = this.peekSaveInfo();
  }

  /** A fresh city and a fresh Rico, from a seed. */
  resetWorld(seed) {
    this.city = buildCity(seed);
    this.seed = seed;
    this.player = {
      x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y, angle: 0,
      hp: 100, armour: 0, cash: START_CASH,
      weapon: 'fists', hasPistol: false, ammo: 0,
    };
    this.playerCar = null;
    this.policeCars = [];
    this.officers = [];
    this.rivals = [];
    this.bullets = [];
    this.particles = [];
    this.pickups = [];
    this.wanted = 0;
    this.lastCrime = -999;
    this.clockMin = 9 * 60;
    this.day = 1;
    this.missionIndex = 0;
    this.stepIndex = 0;
    this.stepState = this.freshStepState();
    this.coinsGot = new Set();
    this.camera = { x: 0, y: 0 };
    this.briefing = null;
    this.prompt = null;
    this.toasts = [];
    this.banner = null;
    this.radioOn = false;
    this.fireCooldown = 0;
    this.rivalSpawned = 0;
    this.rivalDefeated = 0;
    this.collected = 0;
    this.holdTime = 0;
    this.waveTimer = 0;
    this.stepStarted = false;
    this.mission = null;
    this.marker = null;
    this.updateMissionView();
  }

  freshStepState() {
    return { started: false, defeated: 0, collected: 0, hold: 0, wave: 0, spawned: 0 };
  }

  /** What the title screen says about an existing save, if there is one. */
  peekSaveInfo() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      const mission = MISSIONS[s.missionIndex] ? MISSIONS[s.missionIndex].title : 'Story complete';
      return `Save found — $${s.cash}, mission: ${mission}, ${s.coinsTaken.length}/8 Sun Coins. Press Enter to continue.`;
    } catch (err) {
      return null;
    }
  }

  /** Start playing: load the save, or start fresh, and open the first briefing. */
  beginPlay() {
    this.loadSave();
    this.screen = 'play';
    this.audio.ensure();
    this.audio.resume();
    const m = MISSIONS[this.missionIndex];
    if (m) this.showBriefing(m.brief, 9);
    this.updateMissionView();
  }

  loadSave() {
    if (this.shotMode) return;
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      this.player.cash = s.cash ?? START_CASH;
      this.player.hasPistol = !!s.hasPistol;
      this.player.ammo = s.ammo ?? 0;
      if (this.player.hasPistol) this.player.weapon = 'pistol';
      this.missionIndex = Math.min(s.missionIndex ?? 0, MISSIONS.length - 1);
      this.stepIndex = s.stepIndex ?? 0;
      this.day = s.day ?? 1;
      this.clockMin = s.clockMin ?? 9 * 60;
      this.coinsGot = new Set(s.coinsTaken ?? []);
      for (const c of this.city.coins) c.taken = this.coinsGot.has(c.id);
    } catch (err) {
      // A broken save never blocks play.
    }
  }

  saveGame() {
    if (this.shotMode) return;
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: Math.floor(this.player.cash),
        hasPistol: this.player.hasPistol,
        ammo: this.player.ammo,
        missionIndex: this.missionIndex,
        stepIndex: this.stepIndex,
        day: this.day,
        clockMin: Math.floor(this.clockMin),
        coinsTaken: [...this.coinsGot],
      }));
    } catch (err) {
      // Private mode and headless shells may refuse storage; play goes on.
    }
  }

  // ---- Shot-scene helpers: the staging module drives these. ----

  setClockMinutes(min) { this.clockMin = min; }
  setWanted(n) { this.wanted = n; this.lastCrime = this.time; }
  setMissionState(mi, si) {
    this.missionIndex = mi;
    this.stepIndex = si;
    this.stepState = this.freshStepState();
    this.updateMissionView();
  }
  showBriefing(text, seconds = 8) {
    this.briefing = { text, until: this.time + seconds };
  }
  teleportPlayer(x, y, angle) {
    this.player.x = x; this.player.y = y; this.player.angle = angle;
    this.playerCar = null;
    this.snapCamera();
  }
  givePistol(ammo) {
    this.player.hasPistol = true;
    this.player.weapon = 'pistol';
    this.player.ammo = ammo;
  }
  enterCar(modelId, x, y, angle, speed) {
    const model = CAR_MODELS.find((m) => m.id === modelId) || CAR_MODELS[0];
    this.playerCar = { model, color: model.color, x, y, angle, speed, hp: 100 };
    this.player.x = x; this.player.y = y;
    this.snapCamera();
  }
  addPolice(x, y, angle, speed) {
    this.policeCars.push({
      model: CAR_MODELS[0], color: '#2e4a8a', x, y, angle,
      speed: speed || 300, hp: 150, siren: true,
    });
  }
  addTrafficNear(x, y, n, angle, tx, ty) {
    for (let i = 0; i < n; i += 1) {
      const model = CAR_MODELS[(i * 2 + 1) % CAR_MODELS.length];
      this.city.traffic.push({
        id: `shot-traffic-${i}`, model, color: model.color,
        x: x + Math.cos(angle + Math.PI) * i * 150,
        y: y + Math.sin(angle + Math.PI) * i * 150,
        angle, speed: 130, cruise: 130,
        target: { x: tx, y: ty, links: [] }, from: { x: 0, y: 0 },
      });
    }
  }
  addParkedCar(modelId, x, y, angle) {
    const model = CAR_MODELS.find((m) => m.id === modelId) || CAR_MODELS[0];
    this.city.parkedCars.push({ id: `shot-parked-${modelId}`, model, x, y, angle, color: model.color, taken: false });
  }
  clearTrafficNear(x, y, r) {
    this.city.traffic = this.city.traffic.filter((c) => Math.hypot(c.x - x, c.y - y) > r);
  }
  clearPedsNear(x, y, r) {
    this.city.peds = this.city.peds.filter((p) => Math.hypot(p.x - x, p.y - y) > r);
  }
  spawnRival(x, y) {
    this.rivals.push({
      x, y, angle: 0, hp: 100, speed: 130,
      shootTimer: 0.5 + Math.random(), strafe: Math.random() > 0.5 ? 1 : -1,
    });
  }

  snapCamera() {
    const px = this.playerCar ? this.playerCar.x : this.player.x;
    const py = this.playerCar ? this.playerCar.y : this.player.y;
    this.camera.x = clamp(px - VIEW_W / 2, 0, WORLD_W - VIEW_W);
    this.camera.y = clamp(py - VIEW_H / 2, 0, WORLD_H - VIEW_H);
  }

  // ---- The fixed-step simulation. ----

  step(dt, input) {
    this.time += dt;
    this.clockMin += dt * 1.2;
    if (this.clockMin >= 24 * 60) { this.clockMin -= 24 * 60; this.day += 1; }
    if (this.screen !== 'play') return;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.updatePlayer(dt, input);
    this.updatePolice(dt);
    this.updateRivals(dt);
    this.updateBullets(dt);
    this.updatePickups(dt);
    this.updateMissions(dt);
    this.updateWanted(dt);
    updateTraffic(this.city, dt, this.playerCar);
    updatePedestrians(this.city, dt, this.time);
    this.updateParticles(dt);
    this.updateCamera(dt);
    this.audio.setEngine(this.playerCar ? Math.abs(this.playerCar.speed) / this.playerCar.model.top : 0, !!this.playerCar);
    this.audio.setSiren(this.wanted > 0 && this.policeCars.length > 0);
    this.toasts = this.toasts.filter((t) => this.time < t.until);
    input.endStep();
  }

  addToast(text, seconds = 3) {
    this.toasts.push({ text, until: this.time + seconds });
    if (this.toasts.length > 3) this.toasts.shift();
  }

  addWanted(n) {
    this.wanted = Math.min(5, this.wanted + n);
    this.lastCrime = this.time;
  }

  addParticles(x, y, color, count, speed, size, life) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        color, size: size * (0.6 + Math.random() * 0.8),
        life: life * (0.6 + Math.random() * 0.7), maxLife: life,
      });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.92; p.vy *= 0.92;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  updateCamera(dt) {
    const px = this.playerCar ? this.playerCar.x : this.player.x;
    const py = this.playerCar ? this.playerCar.y : this.player.y;
    const tx = clamp(px - VIEW_W / 2, 0, WORLD_W - VIEW_W);
    const ty = clamp(py - VIEW_H / 2, 0, WORLD_H - VIEW_H);
    const k = Math.min(1, 6 * dt);
    this.camera.x += (tx - this.camera.x) * k;
    this.camera.y += (ty - this.camera.y) * k;
  }

  // ---- Rico: on foot and behind the wheel. ----

  updatePlayer(dt, input) {
    const p = this.player;
    if (this.playerCar) {
      this.updateCar(dt, input);
      return;
    }
    const w = input.walkVector();
    const speed = 175;
    const next = collideCircle(this.city, p.x + w.x * speed * dt, p.y + w.y * speed * dt, 12);
    p.x = next.x; p.y = next.y;
    // Aim with the mouse: the world point under the cursor.
    const wx = this.camera.x + input.mouseX;
    const wy = this.camera.y + input.mouseY;
    p.angle = Math.atan2(wy - p.y, wx - p.x);
    if (input.wasPressed('KeyQ')) {
      if (p.weapon === 'fists' && p.hasPistol) p.weapon = 'pistol';
      else p.weapon = 'fists';
    }
    if (input.wasClicked() || input.mouseDown) this.tryAttack(input);
    if (input.wasPressed('KeyE')) this.tryInteract();
    if (input.wasPressed('KeyR')) {
      this.radioOn = this.audio.toggleRadio();
    }
  }

  tryAttack(input) {
    const p = this.player;
    if (this.fireCooldown > 0) return;
    if (p.weapon === 'pistol') {
      if (!p.hasPistol || p.ammo <= 0) {
        p.weapon = 'fists';
        this.addToast('Out of ammo — Ammo-Nation sells more (E)');
        return;
      }
      this.fireCooldown = 0.22;
      p.ammo -= 1;
      const spread = (Math.random() - 0.5) * 0.08;
      const a = p.angle + spread;
      const bx = p.x + Math.cos(a) * 22, by = p.y + Math.sin(a) * 22;
      this.bullets.push({ x: bx, y: by, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: 0.7, from: 'player', damage: 34 });
      this.addParticles(bx, by, '#ffe98a', 4, 160, 3, 0.12);
      this.audio.ensure();
      this.audio.shot();
      this.addWanted(WANTED_FOR_SHOT);
      scarePedestrians(this.city, p.x, p.y, 420, this.time);
    } else {
      this.fireCooldown = 0.38;
      const reach = 42;
      const hx = p.x + Math.cos(p.angle) * reach, hy = p.y + Math.sin(p.angle) * reach;
      this.audio.ensure();
      this.audio.punch();
      this.addParticles(hx, hy, '#fff', 3, 120, 2.5, 0.15);
      for (const r of this.rivals) {
        if (r.hp > 0 && Math.hypot(r.x - hx, r.y - hy) < 26) this.damageRival(r, 25);
      }
      for (const o of this.officers) {
        if (Math.hypot(o.x - hx, o.y - hy) < 26) this.damageOfficer(o, 25);
      }
    }
  }

  updateCar(dt, input) {
    const car = this.playerCar;
    const model = car.model;
    const drive = input.driveAxis();
    const steer = input.steerAxis();
    if (drive !== 0) {
      car.speed += drive * model.accel * dt;
      car.speed = clamp(car.speed, -model.top * 0.45, model.top);
    } else {
      car.speed *= Math.max(0, 1 - 1.6 * dt);
      if (Math.abs(car.speed) < 4) car.speed = 0;
    }
    const steerAmount = steer * 2.4 * dt * clamp(Math.abs(car.speed) / 120, 0, 1) * (car.speed < 0 ? -1 : 1) * model.grip;
    car.angle += steerAmount;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const fixed = collideCircle(this.city, nx, ny, 22);
    if (Math.hypot(fixed.x - nx, fixed.y - ny) > 0.5) {
      car.speed *= 0.55;
      car.hp -= 1;
      if (Math.abs(car.speed) > 200) this.addParticles(car.x, car.y, '#ffb14a', 6, 140, 3, 0.3);
    }
    car.x = fixed.x; car.y = fixed.y;
    this.player.x = car.x; this.player.y = car.y;
    this.player.angle = car.angle;
    // Running over a pedestrian is a crime, and it shows.
    for (const ped of this.city.peds) {
      if (ped.hp > 0 && Math.hypot(ped.x - car.x, ped.y - car.y) < 26 && Math.abs(car.speed) > 60) {
        ped.hp = 0;
        this.addWanted(WANTED_FOR_KILL);
        this.addParticles(ped.x, ped.y, '#e84a4a', 8, 120, 3, 0.4);
        this.addToast('Pedestrian hit! The SBPD is coming.');
      }
    }
    // Shoving traffic aside.
    for (const t of this.city.traffic) {
      const d = Math.hypot(t.x - car.x, t.y - car.y);
      if (d < 46 && d > 0.1) {
        const push = (46 - d) / 2;
        const ux = (t.x - car.x) / d, uy = (t.y - car.y) / d;
        t.x += ux * push; t.y += uy * push;
        car.x -= ux * push * 0.5; car.y -= uy * push * 0.5;
        car.speed *= 0.92;
        car.hp -= 0.5;
      }
    }
    if (car.hp <= 0) {
      this.addParticles(car.x, car.y, '#ff7a2a', 30, 260, 5, 0.9);
      this.addParticles(car.x, car.y, '#333', 20, 120, 7, 1.4);
      this.addToast('Your car is wrecked!');
      this.playerCar = null;
      this.player.x = car.x + 40; this.player.y = car.y;
      return;
    }
    if (input.wasPressed('KeyE')) {
      // Pay 'n Spray first when parked on it: heat gone, car fixed.
      for (const s of SERVICES) {
        if (s.kind === 'spray' && Math.hypot(s.x - car.x, s.y - car.y) < 90) {
          if (this.wanted > 0 && this.player.cash >= SPRAY_PRICE) {
            this.player.cash -= SPRAY_PRICE;
            this.wanted = 0;
            car.hp = 100;
            this.addToast("Pay 'n Spray — you're clean.");
            this.audio.chime();
          } else if (this.wanted === 0) {
            this.addToast("Pay 'n Spray — no heat to lose.");
          } else {
            this.addToast('Not enough cash for the spray.');
          }
          return;
        }
      }
      // Step out beside the car; it stays parked where it stopped.
      this.city.parkedCars.push({ id: `left-${Date.now()}`, model, x: car.x, y: car.y, angle: car.angle, color: car.color, taken: false });
      this.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      this.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      this.playerCar = null;
    }
    if (input.wasPressed('KeyR')) {
      this.radioOn = this.audio.toggleRadio();
    }
  }

  /** The nearest thing E can do right now: a car, a shop, a service. */
  tryInteract() {
    const p = this.player;
    // A parked car within reach is the first priority.
    let best = null, bestD = 60;
    for (const c of this.city.parkedCars) {
      if (c.taken) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bestD) { best = c; bestD = d; }
    }
    if (best) {
      best.taken = true;
      this.playerCar = { model: best.model, color: best.color, x: best.x, y: best.y, angle: best.angle, speed: 0, hp: 100 };
      this.addWanted(WANTED_FOR_STEAL);
      this.addToast(`Stole the ${best.model.name} — lose the heat!`);
      this.audio.ensure();
      return;
    }
    // Otherwise a city service within reach.
    for (const s of SERVICES) {
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d > 80) continue;
      if (s.kind === 'shop') {
        if (!p.hasPistol && p.cash >= PISTOL_PRICE) {
          p.cash -= PISTOL_PRICE;
          p.hasPistol = true; p.weapon = 'pistol'; p.ammo = AMMO_PACK;
          this.addToast(`Bought a pistol + ${AMMO_PACK} rounds ($${PISTOL_PRICE})`);
          this.audio.chime();
        } else if (p.hasPistol && p.cash >= AMMO_PRICE) {
          p.cash -= AMMO_PRICE;
          p.ammo += AMMO_PACK;
          this.addToast(`Bought ${AMMO_PACK} rounds ($${AMMO_PRICE})`);
          this.audio.chime();
        } else {
          this.addToast(p.hasPistol ? 'Not enough cash for ammo.' : 'Not enough cash for a pistol.');
        }
        return;
      }
      if (s.kind === 'heal') {
        if (p.hp >= 100) { this.addToast('Already at full health.'); return; }
        if (p.cash < HEAL_PRICE) { this.addToast('Healing costs $100.'); return; }
        p.cash -= HEAL_PRICE; p.hp = 100;
        this.addToast('Patched up at Solmar General.');
        this.audio.chime();
        return;
      }
      if (s.kind === 'save') {
        p.hp = 100;
        this.saveGame();
        this.addToast('Progress saved at the safehouse.');
        this.audio.chime();
        return;
      }
    }
  }

  /** The prompt line under the crosshair, for the nearest usable thing. */
  updatePrompt() {
    const p = this.player;
    this.prompt = null;
    if (this.playerCar) {
      for (const s of SERVICES) {
        if (s.kind === 'spray' && Math.hypot(s.x - this.playerCar.x, s.y - this.playerCar.y) < 90) {
          this.prompt = this.wanted > 0 ? `E — Pay 'n Spray $${SPRAY_PRICE} (clears ${this.wanted}★)` : "Pay 'n Spray — you're clean";
          return;
        }
      }
      this.prompt = 'E — Get out of the car';
      return;
    }
    let best = null, bestD = 60;
    for (const c of this.city.parkedCars) {
      if (c.taken) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bestD) { best = c; bestD = d; }
    }
    if (best) { this.prompt = `E — Steal the ${best.model.name}`; return; }
    for (const s of SERVICES) {
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d > 80) continue;
      if (s.kind === 'shop') this.prompt = p.hasPistol ? `E — Ammo-Nation: ammo $${AMMO_PRICE}` : `E — Ammo-Nation: pistol $${PISTOL_PRICE}`;
      else if (s.kind === 'heal') this.prompt = `E — Hospital: heal $${HEAL_PRICE}`;
      else if (s.kind === 'save') this.prompt = 'E — Safehouse: save + heal';
      else if (s.kind === 'spray') this.prompt = `E — Pay 'n Spray $${SPRAY_PRICE}`;
      if (this.prompt) return;
    }
  }

  // ---- The SBPD: patrol cars that ram, officers who arrest. ----

  updatePolice(dt) {
    // Keep the street presence matched to the wanted level.
    const wantCars = Math.min(3, this.wanted);
    while (this.policeCars.length < wantCars) {
      const spot = randomRoadPoint(this.city, this.city.rng);
      const d = Math.hypot(spot.x - this.player.x, spot.y - this.player.y);
      if (d > 350 && d < 900) {
        this.policeCars.push({
          model: CAR_MODELS[0], color: '#2e4a8a', x: spot.x, y: spot.y,
          angle: Math.atan2(this.player.y - spot.y, this.player.x - spot.x),
          speed: 200, hp: 150, siren: true,
        });
      } else {
        break;
      }
    }
    if (this.wanted === 0) {
      // No heat: the patrols drift off.
      for (const pc of this.policeCars) pc.speed = Math.max(0, pc.speed - 200 * dt);
      this.policeCars = this.policeCars.filter((pc) => pc.speed > 10 || Math.hypot(pc.x - this.player.x, pc.y - this.player.y) < 700);
    }
    for (const pc of this.policeCars) {
      const dx = this.player.x - pc.x, dy = this.player.y - pc.y;
      const dist = Math.hypot(dx, dy);
      const want = Math.atan2(dy, dx);
      let turn = want - pc.angle;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      // Look ahead: if a building is in the way, swing around it.
      const aheadX = pc.x + Math.cos(pc.angle) * 70, aheadY = pc.y + Math.sin(pc.angle) * 70;
      if (pointInBuilding(this.city, aheadX, aheadY) || pointInWater(this.city, aheadX, aheadY)) {
        turn = turn >= 0 ? 1.2 : -1.2;
      }
      pc.angle += clamp(turn, -3.2 * dt, 3.2 * dt);
      const target = this.wanted > 0 ? 430 : 120;
      pc.speed += (target - pc.speed) * Math.min(1, 1.5 * dt);
      const nx = pc.x + Math.cos(pc.angle) * pc.speed * dt;
      const ny = pc.y + Math.sin(pc.angle) * pc.speed * dt;
      const fixed = collideCircle(this.city, nx, ny, 22);
      if (Math.hypot(fixed.x - nx, fixed.y - ny) > 0.5) pc.speed *= 0.6;
      pc.x = fixed.x; pc.y = fixed.y;
      // Ramming the player.
      if (this.playerCar) {
        const d = Math.hypot(pc.x - this.playerCar.x, pc.y - this.playerCar.y);
        if (d < 44) {
          this.playerCar.hp -= 9 * dt * 60 * 0.02 + 0.4;
          const ux = (this.playerCar.x - pc.x) / (d || 1), uy = (this.playerCar.y - pc.y) / (d || 1);
          this.playerCar.x += ux * 26 * dt * 10;
          this.playerCar.y += uy * 26 * dt * 10;
          this.addParticles(this.playerCar.x, this.playerCar.y, '#ffb14a', 2, 100, 2.5, 0.25);
        }
      } else if (dist < 30) {
        this.damagePlayer(14 * dt, pc.x, pc.y);
      }
    }
    // Foot officers: they chase and, given a second up close, arrest.
    const wantOfficers = this.wanted >= 1 ? Math.min(2, this.wanted - 1 + 1) : 0;
    while (this.officers.length < wantOfficers) {
      const spot = randomSidewalkPoint(this.city, this.city.rng, this.player.x, this.player.y, 420);
      this.officers.push({ x: spot.x, y: spot.y, angle: 0, hp: 120, holdT: 0 });
    }
    if (this.wanted === 0) this.officers = [];
    for (const o of this.officers) {
      const dx = this.player.x - o.x, dy = this.player.y - o.y;
      const dist = Math.hypot(dx, dy);
      o.angle = Math.atan2(dy, dx);
      if (!this.playerCar) {
        const step = collideCircle(this.city, o.x + Math.cos(o.angle) * 205 * dt, o.y + Math.sin(o.angle) * 205 * dt, 12);
        o.x = step.x; o.y = step.y;
        if (dist < 28) {
          o.holdT += dt;
          if (o.holdT > 1.0) { this.busted(); return; }
        } else {
          o.holdT = Math.max(0, o.holdT - dt);
        }
      }
    }
  }

  damagePlayer(amount, fromX, fromY) {
    const p = this.player;
    let rest = amount;
    if (p.armour > 0) {
      const absorbed = Math.min(p.armour, rest * 0.6);
      p.armour -= absorbed;
      rest -= absorbed;
    }
    p.hp -= rest;
    if (fromX !== undefined) {
      const d = Math.hypot(p.x - fromX, p.y - fromY) || 1;
      const push = collideCircle(this.city, p.x + ((p.x - fromX) / d) * 14, p.y + ((p.y - fromY) / d) * 14, 12);
      p.x = push.x; p.y = push.y;
    }
    if (p.hp <= 0) this.wasted();
  }

  damageRival(r, amount) {
    r.hp -= amount;
    this.addParticles(r.x, r.y, '#e84a4a', 6, 130, 3, 0.3);
    if (r.hp <= 0) {
      this.rivalDefeated += 1;
      this.stepState.defeated += 1;
      this.player.cash += 50;
      this.addToast('Rival down — +$50');
      this.addParticles(r.x, r.y, '#a83a5a', 16, 200, 4, 0.6);
    }
  }

  damageOfficer(o, amount) {
    o.hp -= amount;
    if (o.hp <= 0) {
      this.officers = this.officers.filter((x) => x !== o);
      this.addWanted(WANTED_FOR_COP_KILL);
      this.addToast('You dropped an officer! The whole SBPD is coming.');
    }
  }

  busted() {
    this.screen = 'busted';
    this.player.cash = Math.floor(this.player.cash * 0.85);
    this.wanted = 0;
    this.policeCars = [];
    this.officers = [];
    this.playerCar = null;
    this.player.x = HOSPITAL_SPAWN.x; this.player.y = HOSPITAL_SPAWN.y;
    this.player.hp = 100; this.player.armour = 50;
    this.audio.setSiren(false);
    this.audio.setEngine(0, false);
    this.saveGame();
  }

  wasted() {
    this.screen = 'wasted';
    this.player.cash = Math.floor(this.player.cash * 0.9);
    this.wanted = 0;
    this.policeCars = [];
    this.officers = [];
    this.playerCar = null;
    this.player.x = HOSPITAL_SPAWN.x; this.player.y = HOSPITAL_SPAWN.y;
    this.player.hp = 100; this.player.armour = 50;
    this.audio.setSiren(false);
    this.audio.setEngine(0, false);
    this.saveGame();
  }

  // ---- Rival crews: they hold ground and shoot back. ----

  updateRivals(dt) {
    const p = this.player;
    for (const r of this.rivals) {
      if (r.hp <= 0) continue;
      const dx = p.x - r.x, dy = p.y - r.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 560) {
        r.angle = Math.atan2(dy, dx);
        // Keep a fighting distance: close in, or strafe sideways.
        let mx = 0, my = 0;
        if (dist > 300) { mx = Math.cos(r.angle); my = Math.sin(r.angle); }
        else if (dist < 160) { mx = -Math.cos(r.angle); my = -Math.sin(r.angle); }
        else { mx = Math.cos(r.angle + Math.PI / 2) * r.strafe; my = Math.sin(r.angle + Math.PI / 2) * r.strafe; }
        const step = collideCircle(this.city, r.x + mx * r.speed * dt, r.y + my * r.speed * dt, 12);
        r.x = step.x; r.y = step.y;
        r.shootTimer -= dt;
        if (r.shootTimer <= 0 && dist < 520) {
          r.shootTimer = 0.9 + Math.random() * 0.8;
          const spread = (Math.random() - 0.5) * 0.22;
          const a = r.angle + spread;
          this.bullets.push({ x: r.x + Math.cos(a) * 22, y: r.y + Math.sin(a) * 22, vx: Math.cos(a) * 780, vy: Math.sin(a) * 780, life: 0.8, from: 'rival', damage: 9 });
          this.addParticles(r.x + Math.cos(a) * 22, r.y + Math.sin(a) * 22, '#ffe98a', 3, 140, 2.5, 0.1);
          this.audio.ensure();
          this.audio.shot();
          if (Math.random() < 0.3) r.strafe *= -1;
        }
      }
    }
    this.rivals = this.rivals.filter((r) => r.hp > 0 || this.time - (r.deadAt || 0) < 0.5);
    for (const r of this.rivals) if (r.hp <= 0 && !r.deadAt) r.deadAt = this.time;
  }

  // ---- Bullets, pickups, coins, wanted decay. ----

  updateBullets(dt) {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) continue;
      if (pointInBuilding(this.city, b.x, b.y)) {
        b.life = 0;
        this.addParticles(b.x, b.y, '#d8d8d8', 4, 100, 2, 0.25);
        continue;
      }
      if (b.from === 'player') {
        for (const r of this.rivals) {
          if (r.hp > 0 && Math.hypot(r.x - b.x, r.y - b.y) < 15) { this.damageRival(r, b.damage); b.life = 0; break; }
        }
        if (b.life <= 0) continue;
        for (const o of this.officers) {
          if (Math.hypot(o.x - b.x, o.y - b.y) < 15) { this.damageOfficer(o, b.damage); b.life = 0; break; }
        }
        if (b.life <= 0) continue;
        for (const pc of this.policeCars) {
          if (Math.hypot(pc.x - b.x, pc.y - b.y) < 26) {
            pc.hp -= b.damage;
            this.addParticles(b.x, b.y, '#ffb14a', 5, 120, 2.5, 0.25);
            if (pc.hp <= 0) {
              this.addParticles(pc.x, pc.y, '#ff7a2a', 26, 240, 5, 0.8);
              this.policeCars = this.policeCars.filter((x) => x !== pc);
              this.addWanted(WANTED_FOR_COP_KILL);
              this.addToast('SBPD car destroyed!');
            }
            b.life = 0; break;
          }
        }
        if (b.life <= 0) continue;
        for (const ped of this.city.peds) {
          if (ped.hp > 0 && Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
            ped.hp = 0;
            this.addWanted(WANTED_FOR_KILL);
            this.addParticles(ped.x, ped.y, '#e84a4a', 8, 120, 3, 0.4);
            b.life = 0; break;
          }
        }
      } else if (b.from === 'rival') {
        const px = this.playerCar ? this.playerCar.x : this.player.x;
        const py = this.playerCar ? this.playerCar.y : this.player.y;
        if (Math.hypot(px - b.x, py - b.y) < (this.playerCar ? 26 : 13)) {
          if (this.playerCar) this.playerCar.hp -= b.damage * 0.5;
          else this.damagePlayer(b.damage, b.x - b.vx * 0.05, b.y - b.vy * 0.05);
          b.life = 0;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }

  updatePickups(dt) {
    const p = this.player;
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      if (Math.hypot(pk.x - p.x, pk.y - p.y) < 34) {
        pk.taken = true;
        this.player.cash += pk.value;
        this.stepState.collected += 1;
        this.collected += 1;
        this.addToast(`+$${pk.value} cash`);
        this.audio.chime();
        this.addParticles(pk.x, pk.y, '#7ddc8a', 10, 140, 3, 0.4);
      }
    }
    this.pickups = this.pickups.filter((pk) => !pk.taken);
    for (const c of this.city.coins) {
      if (c.taken) continue;
      if (Math.hypot(c.x - p.x, c.y - p.y) < 32) {
        c.taken = true;
        this.coinsGot.add(c.id);
        this.player.cash += COIN_VALUE;
        this.addToast(`Sun Coin! +$${COIN_VALUE} (${this.coinsGot.size}/8)`);
        this.audio.chime();
        this.addParticles(c.x, c.y, '#ffd74f', 14, 180, 3.5, 0.5);
        this.saveGame();
      }
    }
  }

  updateWanted(dt) {
    if (this.wanted > 0 && this.time - this.lastCrime > WANTED_DECAY_SECONDS) {
      this.wanted -= 1;
      this.lastCrime = this.time;
      if (this.wanted === 0) this.addToast('You lost the heat.');
    }
  }

  // ---- The story: six missions, one step at a time. ----

  currentMission() {
    return this.missionIndex < MISSIONS.length ? MISSIONS[this.missionIndex] : null;
  }

  currentStep() {
    const m = this.currentMission();
    if (!m || this.stepIndex >= m.steps.length) return null;
    return m.steps[this.stepIndex];
  }

  /** What the tracker shows, and where the beacon points. */
  updateMissionView() {
    const m = this.currentMission();
    const s = this.currentStep();
    if (!m || !s) {
      this.mission = this.missionIndex >= MISSIONS.length
        ? { title: 'Story Complete', objective: 'Every mission done. Solmar Bay is yours, Rico.', distance: null, progress: '6/6 missions' }
        : null;
      this.marker = null;
      return;
    }
    let progress = '';
    if (s.kind === 'defeat') progress = `${this.stepState.defeated}/${s.count} down`;
    if (s.kind === 'collect') progress = `${this.stepState.collected}/${s.count} collected`;
    if (s.kind === 'hold') progress = `${Math.floor(this.stepState.hold)}/${s.secs}s held`;
    const px = this.playerCar ? this.playerCar.x : this.player.x;
    const py = this.playerCar ? this.playerCar.y : this.player.y;
    this.mission = {
      title: `${this.missionIndex + 1}. ${m.title}`,
      objective: s.text,
      distance: s.x !== undefined ? Math.hypot(s.x - px, s.y - py) : null,
      progress,
    };
    this.marker = s.x !== undefined ? { x: s.x, y: s.y } : null;
  }

  updateMissions(dt) {
    const m = this.currentMission();
    const s = this.currentStep();
    if (!m || !s) return;
    if (!this.stepState.started) {
      this.stepState.started = true;
      if (s.wanted !== undefined) this.setWanted(Math.max(this.wanted, s.wanted));
      if (s.kind === 'defeat') {
        for (let i = 0; i < s.count; i += 1) {
          const a = (i / s.count) * Math.PI * 2;
          this.spawnRival(s.x + Math.cos(a) * (s.r || 200) * 0.6, s.y + Math.sin(a) * (s.r || 200) * 0.6);
        }
        this.showBriefing(`${s.count} rivals ahead. Take them all down.`, 5);
      }
      if (s.kind === 'collect') {
        for (const spot of s.spots) {
          this.pickups.push({ x: spot.x, y: spot.y, value: 200, taken: false });
        }
      }
      if (s.kind === 'hold') {
        this.showBriefing('Hold the lobby! Tía is cracking the vault.', 5);
      }
    }
    const p = this.player;
    const px = this.playerCar ? this.playerCar.x : p.x;
    const py = this.playerCar ? this.playerCar.y : p.y;
    let done = false;
    if (s.kind === 'steal') {
      done = !!this.playerCar;
    } else if (s.kind === 'goto') {
      done = Math.hypot(s.x - px, s.y - py) < s.r;
    } else if (s.kind === 'defeat') {
      done = this.stepState.defeated >= s.count;
    } else if (s.kind === 'collect') {
      done = this.stepState.collected >= s.count;
    } else if (s.kind === 'hold') {
      const inside = Math.hypot(s.x - px, s.y - py) < s.r;
      if (inside) {
        this.stepState.hold += dt;
        this.stepState.wave += dt;
        if (this.stepState.wave > 6 && this.stepState.spawned < 8) {
          this.stepState.wave = 0;
          this.stepState.spawned += 1;
          this.spawnRival(s.x + (Math.random() - 0.5) * 500, s.y + (Math.random() - 0.5) * 500);
        }
      } else {
        this.stepState.hold = Math.max(0, this.stepState.hold - dt * 0.5);
      }
      done = this.stepState.hold >= s.secs;
    }
    if (done) this.advanceStep();
    this.updateMissionView();
  }

  advanceStep() {
    const m = this.currentMission();
    this.stepIndex += 1;
    this.stepState = this.freshStepState();
    if (this.stepIndex >= m.steps.length) {
      this.player.cash += m.reward;
      this.banner = { text: `${m.title} — DONE`, sub: `+$${m.reward}`, until: this.time + 4 };
      this.audio.missionDone();
      this.missionIndex += 1;
      this.stepIndex = 0;
      this.saveGame();
      const next = this.currentMission();
      if (next) {
        this.showBriefing(next.brief, 9);
      } else {
        this.banner = { text: 'STORY COMPLETE', sub: 'Solmar Bay is yours, Rico.', until: this.time + 6 };
        this.showBriefing('TIA CARMEN: That\'s the whole story, Rico. The city is yours now.', 9);
      }
    }
    this.updateMissionView();
  }

  // ---- The frame loop and the boot. ----

  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000 || 0);
    this.last = now;
    if (!this.frozen) {
      if (this.screen === 'title') {
        if (this.input.wasPressed('Enter')) this.beginPlay();
      } else if (this.screen === 'play') {
        if (this.input.wasPressed('KeyP') || this.input.wasPressed('Escape')) {
          this.screen = 'pause';
        } else {
          this.acc += dt;
          let guard = 0;
          while (this.acc >= STEP && guard < 8) {
            this.step(STEP, this.input);
            this.acc -= STEP;
            guard += 1;
          }
          if (guard >= 8) this.acc = 0;
        }
      } else if (this.screen === 'pause') {
        if (this.input.wasPressed('KeyP') || this.input.wasPressed('Escape') || this.input.wasPressed('Enter')) {
          this.screen = 'play';
        }
      } else if (this.screen === 'busted' || this.screen === 'wasted') {
        if (this.input.wasPressed('Enter')) {
          this.screen = 'play';
          this.snapCamera();
        }
      }
    }
    if (this.screen === 'play') this.updatePrompt();
    this.audio.ensure();
    drawGame(this.ctx, this.view());
    requestAnimationFrame((t) => this.frame(t));
  }

  /** Everything the renderer needs, in one plain object. */
  view() {
    return {
      city: this.city,
      player: this.player,
      playerCar: this.playerCar,
      policeCars: this.policeCars,
      officers: this.officers,
      rivals: this.rivals,
      bullets: this.bullets,
      particles: this.particles,
      pickups: this.pickups,
      wanted: this.wanted,
      cash: Math.floor(this.player.cash),
      clockMin: this.clockMin,
      day: this.day,
      time: this.time,
      camera: this.camera,
      screen: this.screen,
      mission: this.mission,
      marker: this.marker,
      briefing: this.briefing,
      prompt: this.prompt,
      toasts: this.toasts,
      banner: this.banner,
      radioOn: this.radioOn,
      saveInfo: this.saveInfo,
    };
  }

  start() {
    if (this.shotName) {
      try {
        stageShot(this.shotName, this);
      } catch (err) {
        if (typeof window !== 'undefined') window.__shotError = String(err && err.message || err);
      }
    }
    this.snapCamera();
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }
}

/** Boot the game from the page. */
const canvas = document.getElementById('game');
const game = new Game(canvas);
if (typeof window !== 'undefined') window.__solmarBay = game;
game.start();
