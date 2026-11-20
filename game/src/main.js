// main.js — Solmar Bay itself: the game loop, the player on foot and behind
// the wheel, traffic and police on the road graph, pedestrians, combat,
// the six missions, the wanted level, the day/night clock and the save.
// Render lives in render.js, the city in world.js, sound in audio.js.

import { makeRng, clamp, dist, angleTo, angleDiff } from './random.js';
import {
  WORLD, ROADS_X, ROADS_Y, CAR_TYPES, CAR_TYPE_KEYS, SERVICES, COIN_SPOTS,
  COIN_VALUE, MISSIONS, PLAYER, WANTED, CLOCK, SAVE_KEY, districtAt,
} from './config.js';
import { buildWorld, findRoute, nearestNode, solidAt, moveWithCollision } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { render, isNight } from './render.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(window.location.search);
const seedParam = params.get('seed');
const shotParam = params.get('shot');
const seed = seedParam ? Number(seedParam) : (Date.now() % 100000);

const world = buildWorld(seed);
const input = createInput(canvas);
const audio = createAudio();

const PED_COLORS = ['#e8e4da', '#7fb069', '#c96f4a', '#5a7fa8', '#d8b73c', '#a06a9e', '#6a8a7a'];

function newPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0, vx: 0, vy: 0,
    health: PLAYER.maxHealth, armour: 0,
    weapon: 'fists', ammo: 24, cash: 100,
    inCar: false, car: null,
  };
}

function makeTrafficCar(rng, i) {
  const from = rng.int(0, world.graph.nodes.length - 1);
  const to = rng.int(0, world.graph.nodes.length - 1);
  const node = world.graph.nodes[from];
  const type = rng.pick(CAR_TYPE_KEYS);
  return {
    x: node.x + rng.range(-10, 10), y: node.y + rng.range(-10, 10),
    angle: rng.range(0, Math.PI * 2), speed: 0,
    type, color: null, traffic: true, parked: false, police: false,
    route: findRoute(world.graph, from, to), routeIdx: 1,
    cruise: rng.range(170, 260), bounceT: rng.range(0, 6),
  };
}

function makePed(rng) {
  const rx = ROADS_X[rng.int(0, ROADS_X.length - 1)];
  const ry = ROADS_Y[rng.int(0, ROADS_Y.length - 1)];
  return {
    x: clamp(rx + rng.range(-220, 220), 40, WORLD.w - 40),
    y: clamp(ry + rng.range(-220, 220), 40, WORLD.h - 40),
    angle: rng.range(0, Math.PI * 2), speed: 0,
    color: rng.pick(PED_COLORS), fleeing: false, fleeX: 0, fleeY: 0,
    rival: false, health: 100, maxHealth: 100, weapon: 'fists',
    wanderT: rng.range(0, 3), tx: 0, ty: 0, shootT: 0,
  };
}

function makeOfficer(x, y) {
  return {
    x, y, angle: 0, speed: 0, color: '#1d2f4a', fleeing: false,
    rival: false, health: 100, maxHealth: 100, weapon: 'fists',
    officer: true, arrestT: 0, wanderT: 0, tx: 0, ty: 0, shootT: 0,
  };
}

function createState() {
  const rng = makeRng(seed + 77);
  const cars = [];
  for (const p of world.parked) {
    cars.push({
      x: p.x, y: p.y, angle: p.angle, speed: 0,
      type: p.type, color: p.color, traffic: false, parked: true,
      police: false, missionCar: p.missionCar, bounceT: 0,
    });
  }
  for (let i = 0; i < 14; i++) cars.push(makeTrafficCar(rng, i));
  const peds = [];
  for (let i = 0; i < 26; i++) peds.push(makePed(rng));
  return {
    mode: 'title',
    time: 0,
    hours: CLOCK.startHour,
    wanted: 0,
    quietT: 0,
    player: newPlayer(350, 420),
    cars,
    peds,
    officers: [],
    particles: [],
    tracers: [],
    camera: { x: 350, y: 420 },
    missionIndex: 0,
    mission: null,
    missionStep: null,
    missionStepIndex: 0,
    fightLeft: 0,
    holdT: 0,
    banner: '',
    bannerT: 0,
    prompt: '',
    district: 'Old Town',
    coinsCollected: 0,
    missionsDone: 0,
    radioOn: false,
    hasSave: false,
    rng,
    spawnT: 0,
    policeT: 0,
    shotName: shotParam,
    shotDrive: false,
  };
}

const S = createState();

// --- Save / load -----------------------------------------------------------

function saveGame() {
  try {
    const data = {
      cash: S.player.cash,
      coins: world.coins.map((c) => c.taken),
      missionsDone: S.missionsDone,
      missionIndex: S.missionIndex,
      hours: S.hours,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch { /* private mode or no storage: the game still plays */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function applySave(data) {
  S.player.cash = data.cash ?? 100;
  S.missionsDone = data.missionsDone ?? 0;
  S.missionIndex = data.missionIndex ?? 0;
  S.hours = data.hours ?? CLOCK.startHour;
  let n = 0;
  world.coins.forEach((c, i) => {
    c.taken = !!(data.coins && data.coins[i]);
    if (c.taken) n++;
  });
  S.coinsCollected = n;
}

S.hasSave = !!loadSave();

// --- Missions --------------------------------------------------------------

function currentMission() {
  return MISSIONS[S.missionIndex] || null;
}

function setBanner(text, seconds) {
  S.banner = text;
  S.bannerT = seconds;
}

function startMission(index) {
  S.missionIndex = index;
  S.mission = MISSIONS[index];
  S.missionStepIndex = 0;
  S.missionStep = S.mission ? S.mission.steps[0] : null;
  S.holdT = 0;
  if (S.mission) {
    setBanner(S.mission.briefing, 7);
    if (S.missionStep && S.missionStep.kind === 'fight') spawnRivals(S.missionStep);
  }
}

function spawnRivals(step) {
  for (let i = 0; i < step.count; i++) {
    const a = (i / step.count) * Math.PI * 2;
    const ped = makePed(S.rng);
    ped.x = clamp(step.x + Math.cos(a) * 120, 40, WORLD.w - 40);
    ped.y = clamp(step.y + Math.sin(a) * 120, 40, WORLD.h - 40);
    ped.rival = true;
    ped.weapon = 'pistol';
    ped.health = 60;
    ped.maxHealth = 60;
    ped.color = '#8a2f2f';
    S.peds.push(ped);
  }
  S.fightLeft = step.count;
}

function advanceStep() {
  const m = S.mission;
  if (!m) return;
  S.missionStepIndex++;
  if (S.missionStepIndex >= m.steps.length) {
    // Mission complete: pay out, cheer, save, move on.
    S.player.cash += m.reward;
    S.missionsDone++;
    audio.missionDone();
    setBanner(`Mission complete: ${m.name} — $${m.reward} earned.`, 5);
    saveGame();
    if (S.missionIndex + 1 < MISSIONS.length) {
      startMission(S.missionIndex + 1);
    } else {
      S.mission = null;
      S.missionStep = null;
      S.mode = 'complete';
    }
    return;
  }
  S.missionStep = m.steps[S.missionStepIndex];
  S.holdT = 0;
  if (S.missionStep.kind === 'fight') spawnRivals(S.missionStep);
  if (S.missionStep.kind === 'hold') setBanner('Hold E to crack the vault — do not stop!', 4);
}

function updateMissionStepText() {
  const step = S.missionStep;
  if (!step) return;
  if (step.kind === 'fight') {
    step.text = step.text.replace(/\(\d+\/\d+\)/, `(${step.count - S.fightLeft}/${step.count})`);
  }
}

// --- Wanted ----------------------------------------------------------------

function addWanted(n) {
  S.wanted = clamp(S.wanted + n, 0, WANTED.maxStars);
  S.quietT = 0;
}

function updateWanted(dt) {
  if (S.wanted === 0) return;
  // Quiet means no police close and no fresh crime: the heat cools off.
  let policeNear = false;
  for (const car of S.cars) {
    if (car.police && dist(car.x, car.y, S.player.x, S.player.y) < 500) policeNear = true;
  }
  for (const off of S.officers) {
    if (dist(off.x, off.y, S.player.x, S.player.y) < 400) policeNear = true;
  }
  if (policeNear) {
    S.quietT = 0;
    return;
  }
  S.quietT += dt;
  if (S.quietT > 25) {
    S.wanted = Math.max(0, S.wanted - 1);
    S.quietT = 0;
  }
}

// --- Combat ----------------------------------------------------------------

function burst(x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = S.rng.range(0, Math.PI * 2);
    const v = S.rng.range(speed * 0.4, speed);
    S.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 1, color, size: S.rng.range(2, 5),
    });
  }
}

function shoot(fromX, fromY, angle, shooter) {
  const range = 520;
  const endX = fromX + Math.cos(angle) * range;
  const endY = fromY + Math.sin(angle) * range;
  let best = null;
  let bestD = range;
  // Nearest living target near the firing line takes the bullet.
  for (const ped of S.peds) {
    if (ped.health <= 0) continue;
    const dx = ped.x - fromX;
    const dy = ped.y - fromY;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    if (along < 0 || along > range) continue;
    const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
    if (perp < 20 && along < bestD) {
      best = ped;
      bestD = along;
    }
  }
  for (const off of S.officers) {
    if (off.health <= 0) continue;
    const dx = off.x - fromX;
    const dy = off.y - fromY;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    if (along < 0 || along > range) continue;
    const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
    if (perp < 20 && along < bestD) {
      best = off;
      bestD = along;
    }
  }
  // A rival's bullet can hit Rico too.
  if (shooter !== S.player) {
    const pl = S.player;
    const dx = pl.x - fromX;
    const dy = pl.y - fromY;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    if (along > 0 && along < bestD) {
      const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
      if (perp < 22) {
        best = pl;
        bestD = along;
      }
    }
  }
  const hitX = best ? best.x : endX;
  const hitY = best ? best.y : endY;
  S.tracers.push({ x1: fromX, y1: fromY, x2: hitX, y2: hitY, life: 1 });
  audio.shot();
  if (best) {
    if (best === S.player) {
      damagePlayer(10);
      burst(hitX, hitY, '#d23c3c', 8, 120);
    } else {
      best.health -= shooter === S.player ? 34 : 10;
      burst(hitX, hitY, '#d23c3c', 8, 120);
      if (best.health <= 0) killPed(best);
    }
  } else {
    burst(hitX, hitY, '#c9b489', 3, 60);
  }
  return best;
}

function killPed(ped) {
  burst(ped.x, ped.y, '#8a2f2f', 16, 160);
  if (ped.rival) {
    S.fightLeft = Math.max(0, S.fightLeft - 1);
    S.player.cash += 25;
    if (S.fightLeft === 0 && S.missionStep && S.missionStep.kind === 'fight') advanceStep();
  } else if (ped.officer) {
    addWanted(WANTED.kill);
  } else {
    addWanted(WANTED.kill);
  }
  ped.health = 0;
}

function punch(fromX, fromY, angle) {
  let hit = null;
  let bestD = 55;
  for (const ped of S.peds) {
    if (ped.health <= 0) continue;
    const d = dist(fromX, fromY, ped.x, ped.y);
    if (d < bestD) {
      hit = ped;
      bestD = d;
    }
  }
  audio.punch();
  if (hit) {
    hit.health -= 20;
    const a = angleTo(fromX, fromY, hit.x, hit.y);
    hit.x += Math.cos(a) * 18;
    hit.y += Math.sin(a) * 18;
    burst(hit.x, hit.y, '#e8b88a', 6, 100);
    if (hit.health <= 0) killPed(hit);
  }
}

// --- Player ----------------------------------------------------------------

function nearestCar(maxD) {
  let best = null;
  let bestD = maxD;
  for (const car of S.cars) {
    if (car.traffic && !car.police) continue; // moving traffic cannot be jacked
    const d = dist(S.player.x, S.player.y, car.x, car.y);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  return best;
}

function enterCar(car) {
  const p = S.player;
  car.parked = false;
  car.traffic = false;
  p.inCar = true;
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  // Stealing in sight of the law draws heat.
  let seen = S.wanted > 0;
  for (const pc of S.cars) {
    if (pc.police && dist(pc.x, pc.y, car.x, car.y) < 500) seen = true;
  }
  if (seen) addWanted(WANTED.steal);
  if (S.missionStep && S.missionStep.kind === 'steal') advanceStep();
  else if (S.missionStep && S.missionStep.kind === 'steal-type' && car.missionCar) advanceStep();
  audio.unlock();
}

function exitCar() {
  const p = S.player;
  const car = p.car;
  if (!car) return;
  car.speed = 0;
  car.parked = true;
  const a = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(a) * 34;
  p.y = car.y + Math.sin(a) * 34;
  p.inCar = false;
  p.car = null;
  p.speed = 0;
}

function updatePlayerOnFoot(dt) {
  const p = S.player;
  const axis = input.axis();
  const len = Math.hypot(axis.x, axis.y) || 1;
  const speed = PLAYER.walkSpeed;
  const dx = (axis.x / len) * speed * dt;
  const dy = (axis.y / len) * speed * dt;
  moveWithCollision(world, p, dx, dy, PLAYER.radius);
  p.speed = Math.hypot(dx, dy) / Math.max(dt, 0.001);
  // Face the mouse.
  const vw = canvas.width;
  const vh = canvas.height;
  const wx = S.camera.x - vw / 2 + input.mouse.x;
  const wy = S.camera.y - vh / 2 + input.mouse.y;
  p.angle = angleTo(p.x, p.y, wx, wy);
  // Attack.
  if (input.mouse.clicked) {
    if (p.weapon === 'pistol' && p.ammo > 0) {
      p.ammo--;
      shoot(p.x, p.y, p.angle, p);
      scarePeds(p.x, p.y);
      if (nearPolice(p.x, p.y, 600)) addWanted(WANTED.shootNearPolice);
    } else if (p.weapon === 'fists') {
      punch(p.x, p.y, p.angle);
    }
  }
  // Enter a car.
  if (input.justPressed('KeyE')) {
    const car = nearestCar(70);
    if (car) enterCar(car);
    else tryService();
  }
}

function nearPolice(x, y, r) {
  for (const car of S.cars) {
    if (car.police && dist(x, y, car.x, car.y) < r) return true;
  }
  for (const off of S.officers) {
    if (dist(x, y, off.x, off.y) < r) return true;
  }
  return false;
}

function scarePeds(x, y) {
  for (const ped of S.peds) {
    if (ped.health <= 0 || ped.rival) continue;
    if (dist(ped.x, ped.y, x, y) < 420) {
      ped.fleeing = true;
      ped.fleeX = ped.x + (ped.x - x);
      ped.fleeY = ped.y + (ped.y - y);
    }
  }
}

function updatePlayerDriving(dt) {
  const p = S.player;
  const car = p.car;
  if (!car) {
    p.inCar = false;
    return;
  }
  const spec = CAR_TYPES[car.type];
  // In a staged screenshot the car keeps its foot down with no keys held.
  const fwd = input.down('KeyW') || input.down('ArrowUp') || S.shotDrive ? 1 : 0;
  const back = input.down('KeyS') || input.down('ArrowDown') ? 1 : 0;
  const steer = (input.down('KeyA') || input.down('ArrowLeft') ? -1 : 0) + (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0);
  if (fwd) car.speed += spec.accel * dt;
  else if (back) car.speed -= spec.accel * 0.8 * dt;
  else car.speed *= Math.max(0, 1 - 1.6 * dt);
  car.speed = clamp(car.speed, -spec.topSpeed * 0.45, spec.topSpeed);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * spec.grip * dt * clamp(Math.abs(car.speed) / 120, 0, 1) * dir;
  car.bounceT = (car.bounceT || 0) + dt * 9;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // A car that hits a wall loses speed instead of passing through it.
  if (!solidAt(world, nx, ny, 16)) {
    car.x = nx;
    car.y = ny;
  } else {
    car.speed *= 0.4;
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = car.speed;
  // Drive-by shooting.
  if (input.mouse.clicked && p.weapon === 'pistol' && p.ammo > 0) {
    const vw = canvas.width;
    const vh = canvas.height;
    const wx = S.camera.x - vw / 2 + input.mouse.x;
    const wy = S.camera.y - vh / 2 + input.mouse.y;
    p.ammo--;
    shoot(car.x + Math.cos(car.angle) * 20, car.y + Math.sin(car.angle) * 20, angleTo(car.x, car.y, wx, wy), p);
    scarePeds(car.x, car.y);
    if (nearPolice(car.x, car.y, 600)) addWanted(WANTED.shootNearPolice);
  }
  if (input.justPressed('KeyE')) exitCar();
  audio.engine(Math.abs(car.speed) / spec.topSpeed, true);
}

// --- Services --------------------------------------------------------------

function tryService() {
  const p = S.player;
  for (const key of Object.keys(SERVICES)) {
    const s = SERVICES[key];
    if (dist(p.x, p.y, s.x, s.y) > s.r) continue;
    if (key === 'ammo') {
      if (p.cash >= 40) {
        p.cash -= 40;
        p.ammo += 24;
        setBanner('Ammo-Nation: +24 pistol rounds. Stay safe out there.', 3);
      } else setBanner('Ammo-Nation: $40 for 24 rounds — you are short.', 3);
    } else if (key === 'spray') {
      if (p.inCar && p.car && p.cash >= 50) {
        p.cash -= 50;
        S.wanted = 0;
        S.quietT = 0;
        setBanner("Pay 'n Spray: fresh paint, clean plates. Heat gone.", 3);
      } else if (!p.inCar) setBanner("Pay 'n Spray: bring a car in, Rico.", 3);
      else setBanner("Pay 'n Spray: $50 — you are short.", 3);
    } else if (key === 'hospital') {
      p.health = PLAYER.maxHealth;
      p.armour = 50;
      setBanner('Solmar General: patched up, good as new.', 3);
    } else if (key === 'safehouse') {
      saveGame();
      setBanner('Safehouse: progress saved.', 3);
    } else if (key === 'bank') {
      setBanner('Solmar Bank: closed to you… unless Tía Carmen says otherwise.', 3);
    }
    return;
  }
}

// --- Traffic, police, pedestrians ------------------------------------------

function updateTraffic(dt) {
  for (const car of S.cars) {
    if (!car.traffic) continue;
    const nodes = world.graph.nodes;
    const target = nodes[car.route[car.routeIdx] ?? car.route[car.route.length - 1]];
    const d = dist(car.x, car.y, target.x, target.y);
    if (d < 36) {
      car.routeIdx++;
      if (car.routeIdx >= car.route.length) {
        const from = nearestNode(world.graph, car.x, car.y);
        const to = S.rng.int(0, nodes.length - 1);
        car.route = findRoute(world.graph, from, to);
        car.routeIdx = 1;
      }
      continue;
    }
    // Slow for the car ahead.
    let slow = false;
    for (const other of S.cars) {
      if (other === car) continue;
      const od = dist(car.x, car.y, other.x, other.y);
      if (od < 46) {
        const ahead = (other.x - car.x) * Math.cos(car.angle) + (other.y - car.y) * Math.sin(car.angle);
        if (ahead > 0) slow = true;
      }
    }
    const want = angleTo(car.x, car.y, target.x, target.y);
    car.angle += clamp(angleDiff(car.angle, want), -2.4 * dt, 2.4 * dt);
    // Ease off for the corner ahead, so traffic turns instead of cutting
    // across the block and stopping on a building.
    const targetSpeed = slow ? 0 : Math.min(car.cruise, d * 1.5 + 60);
    car.speed += clamp(targetSpeed - car.speed, -260 * dt, 180 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
  }
}

function spawnPoliceCar() {
  const nodes = world.graph.nodes;
  let best = 0;
  let bestD = 0;
  for (let i = 0; i < nodes.length; i++) {
    const d = dist(nodes[i].x, nodes[i].y, S.player.x, S.player.y);
    if (d > 500 && d < 1100 && d > bestD) {
      bestD = d;
      best = i;
    }
  }
  const node = nodes[best];
  S.cars.push({
    x: node.x, y: node.y, angle: 0, speed: 0,
    type: 'vela', color: '#1d2f4a', traffic: false, parked: false,
    police: true, siren: true, sirenT: 0, route: [], routeIdx: 0, cruise: 520, bounceT: 0,
  });
}

function updatePolice(dt) {
  // How many patrol cars the heat calls for.
  const wantCars = S.wanted >= 1 ? Math.min(3, S.wanted) : 0;
  const haveCars = S.cars.filter((c) => c.police).length;
  S.policeT += dt;
  if (haveCars < wantCars && S.policeT > 2) {
    spawnPoliceCar();
    S.policeT = 0;
  }
  if (S.wanted === 0) {
    // The heat is off: patrols drive away and despawn far from the player.
    S.cars = S.cars.filter((c) => {
      if (!c.police) return true;
      return dist(c.x, c.y, S.player.x, S.player.y) < 900;
    });
    S.officers = [];
  }
  for (const car of S.cars) {
    if (!car.police) continue;
    car.sirenT = (car.sirenT || 0) + dt;
    if (car.ramT > 0) car.ramT -= dt;
    const p = S.player;
    const d = dist(car.x, car.y, p.x, p.y);
    let want;
    if (d < 170) {
      // Ramming range: straight at the player.
      want = angleTo(car.x, car.y, p.x, p.y);
      car.speed = Math.min(car.speed + 420 * dt, 540);
    } else {
      // Chase along the roads: re-route every second.
      if (!car.routeT || car.routeT <= 0) {
        const from = nearestNode(world.graph, car.x, car.y);
        const to = nearestNode(world.graph, p.x, p.y);
        car.route = findRoute(world.graph, from, to);
        car.routeIdx = 1;
        car.routeT = 1;
      }
      car.routeT -= dt;
      const nodes = world.graph.nodes;
      const target = nodes[car.route[Math.min(car.routeIdx, car.route.length - 1)]];
      if (target && dist(car.x, car.y, target.x, target.y) < 36) car.routeIdx++;
      want = target ? angleTo(car.x, car.y, target.x, target.y) : angleTo(car.x, car.y, p.x, p.y);
      // Ease off for the corner ahead, like traffic does: a patrol car at
      // full speed overshoots the intersection and stops on a building.
      const approach = target ? Math.min(520, dist(car.x, car.y, target.x, target.y) * 1.5 + 80) : 520;
      car.speed = Math.min(car.speed + 380 * dt, approach);
    }
    car.angle += clamp(angleDiff(car.angle, want), -3.2 * dt, 3.2 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!solidAt(world, nx, ny, 16)) {
      car.x = nx;
      car.y = ny;
    } else {
      car.speed *= 0.5;
    }
    // Ramming contact: shove the player and hurt — once per 0.8s, so a
    // patrol car cannot pin the player to a standstill by leaning on it.
    if (d < 42 && (!car.ramT || car.ramT <= 0)) {
      car.ramT = 0.8;
      const a = angleTo(car.x, car.y, p.x, p.y);
      if (p.inCar && p.car) {
        p.car.x += Math.cos(a) * 26;
        p.car.y += Math.sin(a) * 26;
        p.car.speed *= 0.9;
      } else {
        moveWithCollision(world, p, Math.cos(a) * 22, Math.sin(a) * 22, PLAYER.radius);
        damagePlayer(6);
      }
      car.speed *= 0.7;
    }
  }
  // Foot officers join the chase at 2 stars and up.
  const wantOfficers = S.wanted >= 2 ? Math.min(2, S.wanted - 1) : 0;
  while (S.officers.length < wantOfficers) {
    const a = S.rng.range(0, Math.PI * 2);
    S.officers.push(makeOfficer(
      clamp(S.player.x + Math.cos(a) * 320, 40, WORLD.w - 40),
      clamp(S.player.y + Math.sin(a) * 320, 40, WORLD.h - 40),
    ));
  }
  for (const off of S.officers) {
    if (off.health <= 0) continue;
    const d = dist(off.x, off.y, S.player.x, S.player.y);
    const want = angleTo(off.x, off.y, S.player.x, S.player.y);
    off.angle += clamp(angleDiff(off.angle, want), -4 * dt, 4 * dt);
    off.speed = 235;
    moveWithCollision(world, off, Math.cos(off.angle) * off.speed * dt, Math.sin(off.angle) * off.speed * dt, 12);
    if (d < 36 && !S.player.inCar && S.player.speed < 60) {
      off.arrestT += dt;
      if (off.arrestT > 1.2) {
        bustPlayer();
        return;
      }
    } else {
      off.arrestT = 0;
    }
  }
  S.officers = S.officers.filter((o) => o.health > 0);
}

function damagePlayer(n) {
  const p = S.player;
  if (p.armour > 0) {
    const absorbed = Math.min(p.armour, n);
    p.armour -= absorbed;
    n -= absorbed;
  }
  p.health -= n;
  if (p.health <= 0) {
    p.health = 0;
    wastePlayer();
  }
}

function bustPlayer() {
  const p = S.player;
  p.cash = Math.max(0, p.cash - 100);
  S.wanted = 0;
  S.quietT = 0;
  if (p.inCar) exitCar();
  p.x = 390;
  p.y = 470;
  p.health = PLAYER.maxHealth;
  S.mode = 'busted';
  audio.siren(false);
  audio.engine(0, false);
  saveGame();
}

function wastePlayer() {
  const p = S.player;
  p.cash = Math.max(0, p.cash - 150);
  S.wanted = 0;
  S.quietT = 0;
  if (p.inCar) exitCar();
  p.x = 880;
  p.y = 1820;
  p.health = PLAYER.maxHealth;
  p.armour = 0;
  S.mode = 'wasted';
  audio.siren(false);
  audio.engine(0, false);
  saveGame();
}

function updatePeds(dt) {
  for (const ped of S.peds) {
    if (ped.health <= 0) continue;
    const p = S.player;
    const d = dist(ped.x, ped.y, p.x, p.y);
    if (ped.rival) {
      // Rivals close in and shoot when they have a line on Rico.
      const want = angleTo(ped.x, ped.y, p.x, p.y);
      ped.angle += clamp(angleDiff(ped.angle, want), -4 * dt, 4 * dt);
      if (d > 190) {
        ped.speed = 200;
        moveWithCollision(world, ped, Math.cos(ped.angle) * ped.speed * dt, Math.sin(ped.angle) * ped.speed * dt, 12);
      } else {
        ped.speed = 0;
        ped.shootT -= dt;
        if (ped.shootT <= 0) {
          ped.shootT = S.rng.range(0.9, 1.6);
          if (S.rng.chance(0.55)) {
            const a = angleTo(ped.x, ped.y, p.x, p.y) + S.rng.range(-0.14, 0.14);
            shoot(ped.x, ped.y, a, ped);
          }
        }
      }
      continue;
    }
    if (ped.fleeing) {
      const want = angleTo(ped.x, ped.y, ped.fleeX, ped.fleeY);
      ped.angle = want;
      ped.speed = 250;
      moveWithCollision(world, ped, Math.cos(want) * ped.speed * dt, Math.sin(want) * ped.speed * dt, 12);
      if (dist(ped.x, ped.y, ped.fleeX, ped.fleeY) < 60 || d > 700) ped.fleeing = false;
      continue;
    }
    // A quiet stroll: pick a nearby spot, walk to it, pause.
    ped.wanderT -= dt;
    if (ped.wanderT <= 0) {
      ped.tx = clamp(ped.x + S.rng.range(-260, 260), 40, WORLD.w - 40);
      ped.ty = clamp(ped.y + S.rng.range(-260, 260), 40, WORLD.h - 40);
      ped.wanderT = S.rng.range(2, 5);
    }
    const td = dist(ped.x, ped.y, ped.tx, ped.ty);
    if (td > 12) {
      const want = angleTo(ped.x, ped.y, ped.tx, ped.ty);
      ped.angle += clamp(angleDiff(ped.angle, want), -3 * dt, 3 * dt);
      ped.speed = 55;
      moveWithCollision(world, ped, Math.cos(ped.angle) * ped.speed * dt, Math.sin(ped.angle) * ped.speed * dt, 12);
    } else {
      ped.speed = 0;
    }
  }
  S.peds = S.peds.filter((ped) => ped.health > 0);
  // Keep the streets populated.
  S.spawnT += dt;
  if (S.peds.filter((x) => !x.rival).length < 24 && S.spawnT > 2) {
    S.spawnT = 0;
    S.peds.push(makePed(S.rng));
  }
}

// --- Mission steps, coins, prompts -----------------------------------------

function updateMission(dt) {
  const step = S.missionStep;
  if (!step) return;
  updateMissionStepText();
  const p = S.player;
  if (step.kind === 'goto') {
    if (dist(p.x, p.y, step.x, step.y) < step.r) advanceStep();
  } else if (step.kind === 'hold') {
    if (dist(p.x, p.y, step.x, step.y) < step.r && input.down('KeyE')) {
      S.holdT += dt;
      if (S.holdT >= step.hold) {
        // The vault is open — and the whole SBPD knows it.
        p.cash += 0;
        addWanted(4);
        setBanner('Vault cracked! $2,000 in the bag — RUN to the safehouse!', 5);
        advanceStep();
      }
    } else {
      S.holdT = Math.max(0, S.holdT - dt * 2);
    }
  }
  // 'steal', 'steal-type' and 'fight' steps complete in enterCar/killPed.
}

function updateCoins() {
  const p = S.player;
  for (const c of world.coins) {
    if (c.taken) continue;
    if (dist(p.x, p.y, c.x, c.y) < 34) {
      c.taken = true;
      S.coinsCollected++;
      p.cash += COIN_VALUE;
      audio.coin();
      burst(c.x, c.y, '#f7c948', 14, 140);
      setBanner(`Sun Coin found! +$${COIN_VALUE} — ${S.coinsCollected}/8 collected.`, 3);
      saveGame();
    }
  }
}

function updatePrompt() {
  const p = S.player;
  S.prompt = '';
  if (S.missionStep && S.missionStep.kind === 'hold' && dist(p.x, p.y, S.missionStep.x, S.missionStep.y) < S.missionStep.r) {
    S.prompt = `Hold E — cracking the vault ${Math.min(3, S.holdT).toFixed(1)}s / 3s`;
    return;
  }
  if (!p.inCar) {
    const car = nearestCar(70);
    if (car) {
      S.prompt = `Press E to steal the ${CAR_TYPES[car.type].name}`;
      return;
    }
    for (const key of Object.keys(SERVICES)) {
      const s = SERVICES[key];
      if (dist(p.x, p.y, s.x, s.y) < s.r) {
        S.prompt = `Press E — ${s.name}`;
        return;
      }
    }
  } else {
    S.prompt = 'E — get out   •   Click — shoot from the car';
  }
}

function updateCamera(dt) {
  const vw = canvas.width;
  const vh = canvas.height;
  const p = S.player;
  const tx = clamp(p.x, vw / 2, Math.max(vw / 2, WORLD.w - vw / 2));
  const ty = clamp(p.y, vh / 2, Math.max(vh / 2, WORLD.h - vh / 2));
  const k = 1 - Math.pow(0.001, dt);
  S.camera.x += (tx - S.camera.x) * k;
  S.camera.y += (ty - S.camera.y) * k;
  S.district = districtAt(p.x, p.y);
}

function updateFx(dt) {
  for (const t of S.tracers) t.life -= dt * 6;
  S.tracers = S.tracers.filter((t) => t.life > 0);
  for (const pt of S.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 1 - 2 * dt;
    pt.vy *= 1 - 2 * dt;
    pt.life -= dt * 1.6;
  }
  S.particles = S.particles.filter((pt) => pt.life > 0);
  if (S.bannerT > 0) S.bannerT -= dt;
  S.hours = (S.hours + CLOCK.hoursPerSec * dt) % 24;
}

// --- Modes and the loop ------------------------------------------------------

function startGame(fresh) {
  if (fresh) {
    S.player = newPlayer(350, 420);
    S.player.cash = 100;
    S.missionsDone = 0;
    S.missionIndex = 0;
    S.coinsCollected = 0;
    world.coins.forEach((c) => { c.taken = false; });
    S.wanted = 0;
    S.hours = CLOCK.startHour;
  } else {
    const data = loadSave();
    if (data) applySave(data);
  }
  S.mode = 'playing';
  startMission(S.missionIndex);
  audio.unlock();
}

function handleGlobalKeys() {
  if (input.justPressed('Enter')) {
    if (S.mode === 'title') startGame(true);
    else if (S.mode === 'busted' || S.mode === 'wasted') S.mode = 'playing';
    else if (S.mode === 'complete') S.mode = 'playing';
  }
  if (input.justPressed('KeyC') && S.mode === 'title' && S.hasSave) startGame(false);
  if (input.justPressed('KeyP') || input.justPressed('Escape')) {
    if (S.mode === 'playing') {
      S.mode = 'paused';
      audio.engine(0, false);
    } else if (S.mode === 'paused') S.mode = 'playing';
  }
  if (input.justPressed('KeyQ') && S.mode === 'playing') {
    const p = S.player;
    p.weapon = p.weapon === 'pistol' ? 'fists' : 'pistol';
  }
  if (input.justPressed('KeyR') && S.mode === 'playing') {
    S.radioOn = audio.toggleRadio();
  }
  if (input.down('KeyE') || input.down('KeyW') || input.down('KeyA') || input.down('KeyS') || input.down('KeyD') || input.mouse.down) {
    audio.unlock();
  }
}

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  S.time += dt;
  handleGlobalKeys();
  if (S.mode === 'playing') {
    if (S.player.inCar) updatePlayerDriving(dt);
    else updatePlayerOnFoot(dt);
    updateTraffic(dt);
    updatePolice(dt);
    updatePeds(dt);
    updateMission(dt);
    updateCoins();
    updateWanted(dt);
    updateFx(dt);
    updatePrompt();
    audio.siren(S.cars.some((c) => c.police));
    if (!S.player.inCar) audio.engine(0, false);
  } else if (S.mode === 'title') {
    // The title screen drifts slowly over Downtown so it never sits still.
    S.camera.x = 1550 + Math.sin(S.time * 0.05) * 200;
    S.camera.y = 1250 + Math.cos(S.time * 0.04) * 120;
    updateFx(dt);
  }
  updateCamera(dt);
  render(ctx, S, world, canvas.width, canvas.height);
  statusEl.textContent = `Solmar Bay — ${S.district}, ${S.mode}, wanted ${S.wanted}, $${S.player.cash}, mission ${S.missionsDone}/6`;
  input.endFrame();
  requestAnimationFrame(frame);
}

// Shot mode: a deterministic staged scene for screenshots, no title screen,
// no audio, the same seed every time. See shots.js.
if (shotParam) {
  applyShot(S, world, shotParam, seed);
  S.mode = 'playing';
}

requestAnimationFrame(frame);
