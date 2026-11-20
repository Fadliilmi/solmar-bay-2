// Solmar Bay's city: the seeded generator builds the districts, buildings,
// palms, lamps, piers and parked cars, and this module keeps the traffic on
// the roads, the pedestrians on the sidewalks, and everybody out of the walls.

import {
  WORLD_W, WORLD_H, ROAD_X, ROAD_Y, ROAD_W, WATER_X, SAND_X,
  DISTRICTS, CAR_MODELS, COIN_SPOTS, SERVICES, PALETTE, districtAt,
} from './config.js';
import { SeededRandom } from './random.js';

/** The sidewalk band beside a road, where pedestrians walk and cars park. */
export const SIDEWALK = 22;

/** Build the whole city from a seed: the same seed always gives the same city. */
export function buildCity(seed) {
  const rng = new SeededRandom(seed);
  const city = {
    seed, rng, buildings: [], trees: [], lamps: [], piers: [], boats: [],
    parkedCars: [], traffic: [], peds: [], coins: [], nodes: [],
  };

  buildRoadNodes(city);
  buildBuildings(city, rng);
  buildGreenery(city, rng);
  buildMarina(city, rng);
  buildParkedCars(city, rng);
  buildTraffic(city, rng);
  buildPedestrians(city, rng);
  city.coins = COIN_SPOTS.map((s, i) => ({ id: i, x: s.x, y: s.y, hint: s.hint, taken: false }));
  return city;
}

/** Every intersection of the road grid, with its neighbours along the roads. */
function buildRoadNodes(city) {
  const nodes = [];
  for (const x of ROAD_X) {
    for (const y of ROAD_Y) nodes.push({ x, y });
  }
  for (const n of nodes) {
    n.links = nodes.filter((m) => m !== n && ((m.x === n.x && Math.abs(m.y - n.y) === 400) || (m.y === n.y && Math.abs(m.x - n.x) === 400)));
  }
  city.nodes = nodes;
}

/** One building per block, sized and coloured by its district. */
function buildBuildings(city, rng) {
  const xs = [SAND_X + 40, ...ROAD_X.map((x) => x + ROAD_W / 2 + SIDEWALK + 8)];
  const ys = [16, ...ROAD_Y.map((y) => y + ROAD_W / 2 + SIDEWALK + 8)];
  const xe = [...ROAD_X.map((x) => x - ROAD_W / 2 - SIDEWALK - 8), WORLD_W - 16];
  const ye = [...ROAD_Y.map((y) => y - ROAD_W / 2 - SIDEWALK - 8), WORLD_H - 16];
  for (let i = 0; i < xs.length; i += 1) {
    for (let j = 0; j < ys.length; j += 1) {
      const bx = xs[i], by = ys[j], bw = xe[i] - xs[i], bh = ye[j] - ys[j];
      if (bw < 90 || bh < 90) continue;
      const cx = bx + bw / 2, cy = by + bh / 2;
      const d = districtAt(cx, cy);
      if (d.name === 'Beachfront' || d.name === 'Palm Park') continue;
      if (d.name === 'Marina' && cx < 700) continue;
      if (d.name === 'Palm Park') continue;
      const isParkPond = cx > 2560 && cx < 3040 && cy > 900 && cy < 1350;
      if (isParkPond) continue;
      const tall = d.name === 'Downtown';
      const count = d.name === 'Suburbs' ? rng.int(2, 3) : 1;
      for (let k = 0; k < count; k += 1) {
        const w = tall ? rng.range(90, 150) : rng.range(70, Math.min(170, bw - 30));
        const h = tall ? rng.range(90, 150) : rng.range(60, Math.min(130, bh - 30));
        const x = count === 1 ? cx - w / 2 : bx + 20 + rng.range(0, Math.max(1, bw - w - 40));
        const y = count === 1 ? cy - h / 2 : by + 20 + rng.range(0, Math.max(1, bh - h - 40));
        const floors = tall ? rng.int(6, 14) : (d.name === 'Industrial' ? 1 : rng.int(1, 3));
        const cols = Math.max(2, Math.floor(w / 26));
        const rows = Math.max(2, Math.floor(h / 26));
        const lit = [];
        for (let n = 0; n < cols * rows; n += 1) lit.push(rng.chance(0.45));
        city.buildings.push({
          x, y, w, h, floors, cols, rows, lit,
          color: d.name === 'Industrial' ? '#8a7a68' : rng.pick(PALETTE.buildingRoof),
          district: d.name,
        });
      }
    }
  }
}

/** Palms along the beach and in the park, lamps along every road. */
function buildGreenery(city, rng) {
  for (let y = 60; y < WORLD_H - 60; y += 130) {
    city.trees.push({ x: 380 + rng.range(-8, 8), y: y + rng.range(-20, 20), palm: true, s: rng.range(0.9, 1.3) });
  }
  for (let i = 0; i < 46; i += 1) {
    const x = rng.range(2560, 3040), y = rng.range(760, 1440);
    const inPond = (x - 2800) * (x - 2800) / (200 * 200) + (y - 1100) * (y - 1100) / (130 * 130) < 1;
    if (!inPond) city.trees.push({ x, y, palm: rng.chance(0.4), s: rng.range(0.8, 1.4) });
  }
  for (let i = 0; i < 26; i += 1) {
    city.trees.push({ x: rng.range(2560, 3500), y: rng.range(60, 640), palm: rng.chance(0.5), s: rng.range(0.8, 1.2) });
  }
  for (const x of ROAD_X) {
    for (let y = 120; y < WORLD_H; y += 260) {
      city.lamps.push({ x: x + ROAD_W / 2 + 12, y });
      city.lamps.push({ x: x - ROAD_W / 2 - 12, y: y + 130 });
    }
  }
  for (const y of ROAD_Y) {
    for (let x = 520; x < WORLD_W; x += 260) {
      city.lamps.push({ x, y: y + ROAD_W / 2 + 12 });
    }
  }
}

/** Three piers reaching into the ocean, with boats moored beside them. */
function buildMarina(city, rng) {
  for (const py of [2000, 2150, 2300]) {
    city.piers.push({ x: 30, y: py - 18, w: WATER_X - 20, h: 36 });
  }
  for (let i = 0; i < 6; i += 1) {
    city.boats.push({
      x: rng.range(60, 130), y: 1960 + i * 90 + rng.range(-20, 20),
      angle: rng.range(-0.2, 0.2), len: rng.range(46, 70),
    });
  }
}

/** Parked cars along the roadsides: the cars Rico can steal. */
function buildParkedCars(city, rng) {
  const models = rng.shuffle(CAR_MODELS);
  let placed = 0;
  let guard = 0;
  while (placed < 34 && guard < 500) {
    guard += 1;
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(ROAD_X) : rng.pick(ROAD_Y);
    const along = rng.range(120, (vertical ? WORLD_H : WORLD_W) - 120);
    const side = rng.chance(0.5) ? 1 : -1;
    const x = vertical ? road + side * (ROAD_W / 2 + 16) : along;
    const y = vertical ? along : road + side * (ROAD_W / 2 + 16);
    if (x < SAND_X + 30 || x > WORLD_W - 30 || y < 30 || y > WORLD_H - 30) continue;
    if (city.buildings.some((b) => x > b.x - 40 && x < b.x + b.w + 40 && y > b.y - 40 && y < b.y + b.h + 40)) continue;
    if (city.parkedCars.some((c) => Math.hypot(c.x - x, c.y - y) < 90)) continue;
    const model = models[placed % models.length];
    city.parkedCars.push({
      id: `parked-${placed}`, model, x, y,
      angle: vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI),
      color: model.color, taken: false,
    });
    placed += 1;
  }
}

/** Traffic cars that follow the road graph around the city. */
function buildTraffic(city, rng) {
  for (let i = 0; i < 14; i += 1) {
    const node = rng.pick(city.nodes);
    const next = rng.pick(node.links);
    const model = rng.pick(CAR_MODELS);
    city.traffic.push({
      id: `traffic-${i}`, model, color: model.color,
      x: node.x, y: node.y, angle: Math.atan2(next.y - node.y, next.x - node.x),
      speed: rng.range(110, 150), target: next, from: node, cruise: rng.range(110, 150),
    });
  }
}

/** Pedestrians wandering the sidewalks. */
function buildPedestrians(city, rng) {
  for (let i = 0; i < 26; i += 1) {
    const p = randomSidewalkPoint(city, rng, 1800, 1300, 1600);
    city.peds.push({
      id: `ped-${i}`, x: p.x, y: p.y, angle: rng.range(0, Math.PI * 2),
      speed: rng.range(45, 70), tx: p.x, ty: p.y,
      color: rng.pick(PALETTE.ped), fleeUntil: 0, fx: 0, fy: 0, hp: 50,
    });
  }
}

/** A random point on a sidewalk near (cx, cy). */
export function randomSidewalkPoint(city, rng, cx, cy, radius) {
  for (let tries = 0; tries < 40; tries += 1) {
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(ROAD_X) : rng.pick(ROAD_Y);
    const along = (vertical ? cy : cx) + rng.range(-radius, radius);
    const side = rng.chance(0.5) ? 1 : -1;
    const x = vertical ? road + side * (ROAD_W / 2 + 14) : along;
    const y = vertical ? along : road + side * (ROAD_W / 2 + 14);
    if (x > SAND_X && x < WORLD_W - 20 && y > 20 && y < WORLD_H - 20 && !pointInBuilding(city, x, y)) {
      return { x, y };
    }
  }
  return { x: 1200, y: 1200 };
}

/** A random intersection, for spawning police and rivals near the player. */
export function randomRoadPoint(city, rng) {
  const n = rng.pick(city.nodes);
  return { x: n.x, y: n.y };
}

/** True when the point is inside a building or in the ocean off the piers. */
export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

export function pointInWater(city, x, y) {
  if (x >= WATER_X) return false;
  for (const p of city.piers) {
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return false;
  }
  return true;
}

/** True when the point is on a road surface. */
export function pointOnRoad(x, y) {
  for (const rx of ROAD_X) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROAD_Y) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

/**
 * Push a circle out of buildings, water and the world edge. Returns the
 * corrected position; the caller keeps the rest of the velocity.
 */
export function collideCircle(city, x, y, r) {
  let nx = Math.max(r + 4, Math.min(WORLD_W - r - 4, x));
  let ny = Math.max(r + 4, Math.min(WORLD_H - r - 4, y));
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(nx, b.x + b.w));
    const cy = Math.max(b.y, Math.min(ny, b.y + b.h));
    const dx = nx - cx, dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.01) {
      const d = Math.sqrt(d2);
      nx = cx + (dx / d) * r;
      ny = cy + (dy / d) * r;
    } else if (d2 <= 0.01) {
      // Centre inside the building: push out along the smallest overlap.
      const left = nx - b.x, right = b.x + b.w - nx;
      const top = ny - b.y, bottom = b.y + b.h - ny;
      const m = Math.min(left, right, top, bottom);
      if (m === left) nx = b.x - r;
      else if (m === right) nx = b.x + b.w + r;
      else if (m === top) ny = b.y - r;
      else ny = b.y + b.h + r;
    }
  }
  if (pointInWater(city, nx, ny)) {
    // Water is a wall: step back toward the sand.
    nx = Math.max(nx, WATER_X + r);
    if (pointInWater(city, nx, ny)) ny = y;
  }
  return { x: nx, y: ny };
}

/** Move the traffic one step: follow the graph, brake for the player's car. */
export function updateTraffic(city, dt, playerCar) {
  for (const car of city.traffic) {
    const dx = car.target.x - car.x, dy = car.target.y - car.y;
    const dist = Math.hypot(dx, dy);
    const want = Math.atan2(dy, dx);
    let turn = want - car.angle;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    car.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, turn));
    let speed = car.cruise;
    if (playerCar && Math.hypot(playerCar.x - car.x, playerCar.y - car.y) < 90) {
      const ahead = Math.cos(car.angle) * (playerCar.x - car.x) + Math.sin(car.angle) * (playerCar.y - car.y);
      if (ahead > 0) speed = 0;
    }
    car.speed += (speed - car.speed) * Math.min(1, 3 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (dist < 26) {
      const options = car.target.links.filter((n) => n !== car.from);
      const next = options.length ? options[Math.floor(Math.random() * options.length)] : car.from;
      car.from = car.target;
      car.target = next;
    }
  }
}

/** Move the pedestrians: wander the sidewalks, run from gunfire. */
export function updatePedestrians(city, dt, time) {
  for (const p of city.peds) {
    if (p.hp <= 0) continue;
    if (time < p.fleeUntil) {
      const dx = p.x - p.fx, dy = p.y - p.fy;
      const d = Math.hypot(dx, dy) || 1;
      p.angle = Math.atan2(dy / d, dx / d);
      const step = collideCircle(city, p.x + Math.cos(p.angle) * 210 * dt, p.y + Math.sin(p.angle) * 210 * dt, 12);
      p.x = step.x; p.y = step.y;
      continue;
    }
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      const t = randomSidewalkPoint(city, city.rng, p.x, p.y, 500);
      p.tx = t.x; p.ty = t.y;
      continue;
    }
    p.angle = Math.atan2(dy, dx);
    const step = collideCircle(city, p.x + Math.cos(p.angle) * p.speed * dt, p.y + Math.sin(p.angle) * p.speed * dt, 12);
    p.x = step.x; p.y = step.y;
  }
}

/** Every pedestrian within range of a gunshot starts running from it. */
export function scarePedestrians(city, x, y, radius, time) {
  for (const p of city.peds) {
    if (p.hp > 0 && Math.hypot(p.x - x, p.y - y) < radius) {
      p.fleeUntil = time + 2.5;
      p.fx = x; p.fy = y;
    }
  }
}
