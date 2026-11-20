// world.js — builds Solmar Bay from a seed: the road graph, the blocks and
// their buildings, the beach and marina, the park and its pond, the parked
// cars and the people. Everything the game draws or drives on comes from
// here, and the same seed always builds the same city.

import { makeRng, clamp, dist } from './random.js';
import {
  WORLD, ROADS_X, ROADS_Y, ROAD_HALF, SEA_X, BEACH_X, MARINA_Y,
  CAR_TYPE_KEYS, COIN_SPOTS, SERVICES,
} from './config.js';

function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_HALF + 14) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_HALF + 14) return true;
  return false;
}

function inWater(x, y) {
  return x >= SEA_X || y >= MARINA_Y;
}

function inPark(x, y) {
  return x >= 1400 && x < 1700 && y >= 850 && y < 1150;
}

function inPond(x, y) {
  const dx = (x - 1550) / 90;
  const dy = (y - 1000) / 60;
  return dx * dx + dy * dy < 1;
}

// The road graph: one node per intersection, edges along each road.
function buildGraph() {
  const nodes = [];
  const index = new Map();
  for (const y of ROADS_Y) {
    for (const x of ROADS_X) {
      index.set(`${x},${y}`, nodes.length);
      nodes.push({ x, y });
    }
  }
  const edges = nodes.map(() => []);
  const cols = ROADS_X.length;
  nodes.forEach((n, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const link = (j) => {
      edges[i].push(j);
      edges[j].push(i);
    };
    if (col + 1 < cols) link(i + 1);
    if (row + 1 < ROADS_Y.length) link(i + cols);
  });
  return { nodes, edges };
}

// Breadth-first route between two nodes; traffic and police both drive it.
export function findRoute(graph, from, to) {
  if (from === to) return [from];
  const prev = new Array(graph.nodes.length).fill(-1);
  const queue = [from];
  prev[from] = from;
  while (queue.length) {
    const cur = queue.shift();
    if (cur === to) break;
    for (const nb of graph.edges[cur]) {
      if (prev[nb] === -1) {
        prev[nb] = cur;
        queue.push(nb);
      }
    }
  }
  if (prev[to] === -1) return [from, to];
  const path = [];
  let cur = to;
  while (cur !== from) {
    path.unshift(cur);
    cur = prev[cur];
  }
  path.unshift(from);
  return path;
}

export function nearestNode(graph, x, y) {
  let best = 0;
  let bestD = Infinity;
  graph.nodes.forEach((n, i) => {
    const d = dist(x, y, n.x, n.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

export function buildWorld(seed) {
  const rng = makeRng(seed);
  const graph = buildGraph();

  // Buildings fill the blocks between roads, never on a road, in the water,
  // in the park, or on the beach. Each block holds one to four buildings.
  const buildings = [];
  const roofColors = ['#8a6f5c', '#7d6a58', '#96705a', '#6e5a6e', '#5f6e7a', '#a08a6a', '#74555a'];
  const blockXs = [0, ...ROADS_X, WORLD.w];
  const blockYs = [0, ...ROADS_Y, WORLD.h];
  for (let bi = 0; bi < blockXs.length - 1; bi++) {
    for (let bj = 0; bj < blockYs.length - 1; bj++) {
      const x0 = blockXs[bi] + ROAD_HALF + 16;
      const x1 = blockXs[bi + 1] - ROAD_HALF - 16;
      const y0 = blockYs[bj] + ROAD_HALF + 16;
      const y1 = blockYs[bj + 1] - ROAD_HALF - 16;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      // Beach strip and marina water hold no buildings; the park holds none.
      if (x0 >= BEACH_X - 40) continue;
      if (y0 >= MARINA_Y - 40) continue;
      if (x0 >= 1380 && x1 <= 1720 && y0 >= 830 && y1 <= 1170) continue;
      const count = rng.int(2, 4);
      for (let k = 0; k < count; k++) {
        const w = rng.range(70, Math.min(190, x1 - x0 - 20));
        const h = rng.range(60, Math.min(160, y1 - y0 - 20));
        const x = rng.range(x0, Math.max(x0 + 1, x1 - w));
        const y = rng.range(y0, Math.max(y0 + 1, y1 - h));
        // Keep clear of the service lots and the bank so their rings stay open.
        let blocked = false;
        for (const s of Object.values(SERVICES)) {
          if (x < s.x + s.r + 30 && x + w > s.x - s.r - 30 && y < s.y + s.r + 30 && y + h > s.y - s.r - 30) blocked = true;
        }
        if (blocked) continue;
        const cx = x + w / 2;
        const cy = y + h / 2;
        // Never on sand, in the sea or the marina water, in the park or pond.
        if (cx >= BEACH_X - 20 || cx >= SEA_X || cy >= MARINA_Y - 20) continue;
        if (inPark(cx, cy) || inPond(cx, cy)) continue;
        buildings.push({
          x, y, w, h,
          roof: rng.pick(roofColors),
          lit: rng.chance(0.6),
          windows: rng.int(2, 5),
          sign: rng.chance(0.25),
        });
      }
    }
  }

  // Palm trees line the beach and dot the park and suburbs.
  const palms = [];
  for (let y = 120; y < WORLD.h - 120; y += rng.range(90, 170)) {
    palms.push({ x: rng.range(BEACH_X + 30, SEA_X - 60), y, lean: rng.range(-0.2, 0.2) });
  }
  for (let i = 0; i < 26; i++) {
    const x = rng.range(1450, 1650);
    const y = rng.range(880, 1120);
    if (!inPond(x, y)) palms.push({ x, y, lean: rng.range(-0.15, 0.15) });
  }
  for (let i = 0; i < 30; i++) {
    palms.push({ x: rng.range(850, 2750), y: rng.range(60, 700), lean: rng.range(-0.15, 0.15) });
  }

  // Street lamps stand at every other intersection corner.
  const lamps = [];
  graph.nodes.forEach((n, i) => {
    if (i % 2 === 0) lamps.push({ x: n.x + ROAD_HALF + 8, y: n.y - ROAD_HALF - 8 });
  });

  // Marina piers reach south into the water; boats moor beside them.
  const piers = [];
  const boats = [];
  for (const px of [700, 1300, 1900, 2500]) {
    piers.push({ x: px, y: MARINA_Y, w: 26, h: 190 });
    boats.push({ x: px + 55, y: MARINA_Y + rng.range(60, 140), angle: rng.range(-0.3, 0.3), len: 64, color: rng.pick(['#e8e4da', '#c25a3a', '#3a6ea8']) });
    boats.push({ x: px - 55, y: MARINA_Y + rng.range(60, 150), angle: rng.range(-0.3, 0.3), len: 52, color: rng.pick(['#e8e4da', '#d8b73c', '#5e7d6a']) });
  }

  // Parked cars wait at curbs all over town; one red Cometa GT waits in
  // Downtown for the Hot Wheels job, always at the same corner.
  const parked = [];
  const usedSpots = [];
  function freeSpot(x, y) {
    if (onRoad(x, y) || inWater(x, y) || inPark(x, y)) return false;
    for (const s of usedSpots) if (dist(x, y, s.x, s.y) < 120) return false;
    for (const b of buildings) {
      if (x > b.x - 40 && x < b.x + b.w + 40 && y > b.y - 40 && y < b.y + b.h + 40) return false;
    }
    return true;
  }
  parked.push({ x: 1850, y: 1080, angle: 0, type: 'cometa', color: '#c22f2f', missionCar: true });
  usedSpots.push({ x: 1850, y: 1080 });
  const curbSpots = [];
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      curbSpots.push({ x: rx + ROAD_HALF + 30, y: ry + rng.range(-160, 160), angle: 0 });
      curbSpots.push({ x: rx - ROAD_HALF - 30, y: ry + rng.range(-160, 160), angle: 0 });
    }
  }
  let placed = 0;
  for (const spot of curbSpots) {
    if (placed >= 11) break;
    if (!freeSpot(spot.x, spot.y)) continue;
    const type = rng.pick(CAR_TYPE_KEYS);
    parked.push({ x: spot.x, y: clamp(spot.y, 60, WORLD.h - 60), angle: rng.chance(0.5) ? 0 : Math.PI, type, color: null, missionCar: false });
    usedSpots.push({ x: spot.x, y: spot.y });
    placed++;
  }

  // Sun Coins sit where the config put them.
  const coins = COIN_SPOTS.map((c) => ({ ...c, taken: false }));

  return {
    seed, rng, graph, buildings, palms, lamps, piers, boats, parked, coins,
    onRoad, inWater, inPark, inPond,
  };
}

// Is this point drivable or walkable? Not inside a building, not in deep
// water, not in the pond. The beach sand and the piers are fine.
export function solidAt(world, x, y, radius) {
  if (x < radius || y < radius || x > WORLD.w - radius || y > WORLD.h - radius) return true;
  if (world.inPond(x, y)) return true;
  if (x >= SEA_X + 40 || y >= MARINA_Y + 40) {
    // Piers are walkable boards over the water.
    for (const p of world.piers) {
      if (x > p.x - 4 && x < p.x + p.w + 4 && y > p.y - 10 && y < p.y + p.h) return false;
    }
    return true;
  }
  for (const b of world.buildings) {
    if (x > b.x - radius && x < b.x + b.w + radius && y > b.y - radius && y < b.y + b.h + radius) return true;
  }
  return false;
}

// Slide along a wall instead of stopping dead: try the full step, then each
// axis on its own.
export function moveWithCollision(world, pos, dx, dy, radius) {
  const nx = pos.x + dx;
  const ny = pos.y + dy;
  if (!solidAt(world, nx, ny, radius)) {
    pos.x = nx;
    pos.y = ny;
    return;
  }
  if (!solidAt(world, nx, pos.y, radius)) pos.x = nx;
  else if (!solidAt(world, pos.x, ny, radius)) pos.y = ny;
}
