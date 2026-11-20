// render.js — everything Solmar Bay shows on screen, drawn on one canvas:
// the city, the sea and the beach, the cars and the people, the night and
// its headlights, then the HUD with its minimap and wanted stars. No images,
// no fonts from the network: every pixel is drawn from the world data.

import {
  WORLD, ROADS_X, ROADS_Y, ROAD_HALF, SEA_X, BEACH_X, MARINA_Y,
  CAR_TYPES, SERVICES, PALETTE, DISTRICTS,
} from './config.js';
import { districtAt } from './config.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function isNight(hours) {
  return hours >= 20 || hours < 6;
}

function drawGround(ctx, cam, vw, vh, time) {
  const x0 = cam.x - vw / 2;
  const y0 = cam.y - vh / 2;
  const x1 = cam.x + vw / 2;
  const y1 = cam.y + vh / 2;
  // Base grass.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, vw, vh);
  // District tints, so each part of town reads at a glance.
  for (const d of DISTRICTS) {
    const ix = Math.max(d.x, x0);
    const iy = Math.max(d.y, y0);
    const ix2 = Math.min(d.x + d.w, x1);
    const iy2 = Math.min(d.y + d.h, y1);
    if (ix2 <= ix || iy2 <= iy) continue;
    ctx.fillStyle = d.ground;
    ctx.fillRect(ix, iy, ix2 - ix, iy2 - iy);
  }
  // Beach sand, then the sea with a slow swell.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(Math.max(BEACH_X, x0), y0, Math.min(SEA_X, x1) - Math.max(BEACH_X, x0), vh);
  const swell = Math.sin(time * 0.7) * 4;
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(Math.max(SEA_X, x0), y0, x1 - Math.max(SEA_X, x0), vh);
  ctx.fillStyle = PALETTE.seaDeep;
  for (let y = Math.floor(y0 / 90) * 90; y < y1; y += 90) {
    ctx.fillRect(Math.max(SEA_X, x0), y + swell, x1 - Math.max(SEA_X, x0), 3);
  }
  // Marina water along the south, with a pale shore line.
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(x0, Math.max(MARINA_Y, y0), vw, y1 - Math.max(MARINA_Y, y0));
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x0, MARINA_Y - 2, vw, 3);
  // Foam where the sea meets the sand.
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(SEA_X - 3 + swell * 0.5, y0, 4, vh);
}

function drawRoads(ctx, cam, vw, vh) {
  const x0 = cam.x - vw / 2;
  const y0 = cam.y - vh / 2;
  const x1 = cam.x + vw / 2;
  const y1 = cam.y + vh / 2;
  ctx.fillStyle = PALETTE.road;
  for (const rx of ROADS_X) {
    if (rx + ROAD_HALF < x0 || rx - ROAD_HALF > x1) continue;
    ctx.fillRect(rx - ROAD_HALF, y0, ROAD_HALF * 2, vh);
  }
  for (const ry of ROADS_Y) {
    if (ry + ROAD_HALF < y0 || ry - ROAD_HALF > y1) continue;
    ctx.fillRect(x0, ry - ROAD_HALF, vw, ROAD_HALF * 2);
  }
  // Sidewalks: pale strips hugging each road.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of ROADS_X) {
    if (rx + ROAD_HALF + 12 < x0 || rx - ROAD_HALF - 12 > x1) continue;
    ctx.fillRect(rx - ROAD_HALF - 12, y0, 10, vh);
    ctx.fillRect(rx + ROAD_HALF + 2, y0, 10, vh);
  }
  for (const ry of ROADS_Y) {
    if (ry + ROAD_HALF + 12 < y0 || ry - ROAD_HALF - 12 > y1) continue;
    ctx.fillRect(x0, ry - ROAD_HALF - 12, vw, 10);
    ctx.fillRect(x0, ry + ROAD_HALF + 2, vw, 10);
  }
  // Centre dashes.
  ctx.fillStyle = PALETTE.roadLine;
  for (const rx of ROADS_X) {
    if (rx < x0 || rx > x1) continue;
    for (let y = Math.floor(y0 / 64) * 64; y < y1; y += 64) {
      let onRoad = false;
      for (const ry of ROADS_Y) if (Math.abs(y - ry) < ROAD_HALF + 20) onRoad = true;
      if (!onRoad) ctx.fillRect(rx - 2, y, 4, 30);
    }
  }
  for (const ry of ROADS_Y) {
    if (ry < y0 || ry > y1) continue;
    for (let x = Math.floor(x0 / 64) * 64; x < x1; x += 64) {
      let onRoad = false;
      for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_HALF + 20) onRoad = true;
      if (!onRoad) ctx.fillRect(x, ry - 2, 30, 4);
    }
  }
}

function drawPark(ctx, world, cam, vw, vh) {
  const x0 = cam.x - vw / 2;
  const y0 = cam.y - vh / 2;
  if (1700 < x0 || 1400 > x0 + vw || 1150 < y0 || 850 > y0 + vh) return;
  // Pond, ringed by grass.
  ctx.fillStyle = PALETTE.pond;
  ctx.beginPath();
  ctx.ellipse(1550, 1000, 90, 60, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c9b489';
  ctx.lineWidth = 4;
  ctx.stroke();
  // Footpaths crossing the park.
  ctx.fillStyle = '#b8a888';
  ctx.fillRect(1400, 990, 300, 20);
  ctx.fillRect(1540, 850, 20, 300);
}

function drawPiersAndBoats(ctx, world, night) {
  for (const p of world.piers) {
    ctx.fillStyle = '#7a5c38';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#8f6f45';
    for (let y = p.y + 8; y < p.y + p.h; y += 22) ctx.fillRect(p.x + 2, y, p.w - 4, 3);
  }
  for (const b of world.boats) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = b.color;
    roundRect(ctx, -b.len / 2, -11, b.len, 22, 10);
    ctx.fill();
    ctx.fillStyle = '#2c4a5a';
    ctx.fillRect(-b.len / 4, -6, b.len / 2, 12);
    ctx.restore();
  }
}

function drawBuildings(ctx, world, cam, vw, vh, night, time) {
  const x0 = cam.x - vw / 2;
  const y0 = cam.y - vh / 2;
  const x1 = cam.x + vw / 2;
  const y1 = cam.y + vh / 2;
  for (const b of world.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    // A soft shadow falls south-east, so the blocks feel solid.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    // Roof detail: a darker inner court.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
    // Windows glow after dark on the lit buildings.
    if (night && b.lit) {
      ctx.fillStyle = '#ffd873';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if (((i * 7 + j * 3 + Math.floor(time)) % 5) < 3) {
            ctx.fillRect(b.x + 8 + i * 26, b.y + 8 + j * 26, 12, 12);
          }
        }
      }
    }
    if (b.sign) {
      ctx.fillStyle = '#e8e4da';
      ctx.fillRect(b.x + b.w / 2 - 16, b.y - 6, 32, 8);
    }
  }
}

function drawPalms(ctx, world, cam, vw, vh) {
  const x0 = cam.x - vw / 2;
  const y0 = cam.y - vh / 2;
  const x1 = cam.x + vw / 2;
  const y1 = cam.y + vh / 2;
  for (const p of world.palms) {
    if (p.x < x0 - 20 || p.x > x1 + 20 || p.y < y0 - 20 || p.y > y1 + 20) continue;
    ctx.strokeStyle = '#6b4a2c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + p.lean * 30, p.y - 22);
    ctx.stroke();
    ctx.fillStyle = '#3f7d33';
    const tx = p.x + p.lean * 30;
    const ty = p.y - 22;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(tx + Math.cos(a) * 12, ty + Math.sin(a) * 8, 13, 5, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawLamps(ctx, world, cam, vw, vh, night) {
  const x0 = cam.x - vw / 2;
  const y0 = cam.y - vh / 2;
  const x1 = cam.x + vw / 2;
  const y1 = cam.y + vh / 2;
  for (const l of world.lamps) {
    if (l.x < x0 - 60 || l.x > x1 + 60 || l.y < y0 - 60 || l.y > y1 + 60) continue;
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
    if (night) {
      const g = ctx.createRadialGradient(l.x, l.y, 4, l.x, l.y, 70);
      g.addColorStop(0, 'rgba(255,214,120,0.35)');
      g.addColorStop(1, 'rgba(255,214,120,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(l.x, l.y, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(l.x, l.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawCar(ctx, car) {
  const spec = CAR_TYPES[car.type];
  const bounce = car.type === 'bajito' && car.speed > 60 ? Math.sin(car.bounceT || 0) * 1.5 : 0;
  ctx.save();
  ctx.translate(car.x, car.y + bounce);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -spec.len / 2 + 3, -spec.wid / 2 + 4, spec.len, spec.wid, 8);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.police ? '#1d2f4a' : (car.color || spec.color);
  roundRect(ctx, -spec.len / 2, -spec.wid / 2, spec.len, spec.wid, 8);
  ctx.fill();
  if (car.police) {
    ctx.fillStyle = '#e8e4da';
    ctx.fillRect(-6, -spec.wid / 2, 12, spec.wid);
    ctx.fillStyle = '#c22f2f';
    ctx.fillRect(-spec.len / 2 + 4, -spec.wid / 2, 8, 6);
    ctx.fillStyle = '#2f6fc2';
    ctx.fillRect(-spec.len / 2 + 4, spec.wid / 2 - 6, 8, 6);
  }
  // Windshield and roof.
  ctx.fillStyle = 'rgba(20,30,40,0.75)';
  roundRect(ctx, spec.len / 2 - 18, -spec.wid / 2 + 4, 12, spec.wid - 8, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  roundRect(ctx, -8, -spec.wid / 2 + 4, 16, spec.wid - 8, 4);
  ctx.fill();
  // Headlights.
  ctx.fillStyle = '#fff6c8';
  ctx.fillRect(spec.len / 2 - 2, -spec.wid / 2 + 3, 3, 5);
  ctx.fillRect(spec.len / 2 - 2, spec.wid / 2 - 8, 3, 5);
  ctx.fillStyle = '#c22f2f';
  ctx.fillRect(-spec.len / 2, -spec.wid / 2 + 3, 3, 5);
  ctx.fillRect(-spec.len / 2, spec.wid / 2 - 8, 3, 5);
  ctx.restore();
  // Police light bar flash.
  if (car.police && car.siren) {
    const phase = Math.floor((car.sirenT || 0) * 4) % 2 === 0;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = phase ? 'rgba(255,60,60,0.9)' : 'rgba(60,120,255,0.9)';
    ctx.beginPath();
    ctx.arc(-2, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPerson(ctx, p, isPlayer, night) {
  ctx.save();
  ctx.translate(p.x, p.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 12, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.angle + Math.PI / 2);
  const shirt = isPlayer ? '#e8572a' : p.color;
  // Legs.
  ctx.fillStyle = '#2c3240';
  ctx.fillRect(-7, 2, 5, 12);
  ctx.fillRect(2, 2, 5, 12);
  // Body.
  ctx.fillStyle = shirt;
  roundRect(ctx, -9, -12, 18, 16, 6);
  ctx.fill();
  // Head.
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath();
  ctx.arc(0, -16, 7, 0, Math.PI * 2);
  ctx.fill();
  // Hair or cap.
  ctx.fillStyle = isPlayer ? '#1c1c1c' : '#3a2c1c';
  ctx.beginPath();
  ctx.arc(0, -17, 7, Math.PI, Math.PI * 2);
  ctx.fill();
  // Gun in hand when armed.
  if (p.weapon === 'pistol') {
    ctx.fillStyle = '#222';
    ctx.fillRect(6, -14, 12, 4);
  }
  ctx.restore();
  // Health pip above rivals and officers.
  if (!isPlayer && p.health !== undefined && p.health < p.maxHealth) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(p.x - 14, p.y - 34, 28, 5);
    ctx.fillStyle = '#d23c3c';
    ctx.fillRect(p.x - 13, p.y - 33, 26 * Math.max(0, p.health / p.maxHealth), 3);
  }
}

function drawCoins(ctx, world, cam, vw, vh, time) {
  const x0 = cam.x - vw / 2;
  const y0 = cam.y - vh / 2;
  const x1 = cam.x + vw / 2;
  const y1 = cam.y + vh / 2;
  for (const c of world.coins) {
    if (c.taken) continue;
    if (c.x < x0 - 20 || c.x > x1 + 20 || c.y < y0 - 20 || c.y > y1 + 20) continue;
    const bob = Math.sin(time * 3 + c.x) * 3;
    const spin = Math.abs(Math.sin(time * 2 + c.y));
    ctx.save();
    ctx.translate(c.x, c.y + bob);
    ctx.fillStyle = '#f7c948';
    ctx.beginPath();
    ctx.ellipse(0, 0, 6 + spin * 6, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a87f14';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#a87f14';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', 0, 0);
    ctx.restore();
  }
}

function drawServices(ctx, world, cam, vw, vh) {
  const x0 = cam.x - vw / 2;
  const y0 = cam.y - vh / 2;
  const x1 = cam.x + vw / 2;
  const y1 = cam.y + vh / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const key of Object.keys(SERVICES)) {
    const s = SERVICES[key];
    if (s.x < x0 - 120 || s.x > x1 + 120 || s.y < y0 - 120 || s.y > y1 + 120) continue;
    // Lot pad and sign.
    ctx.fillStyle = 'rgba(20,20,24,0.55)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd873';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(s.name.toUpperCase(), s.x, s.y - s.r - 14);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '11px sans-serif';
    ctx.fillText('E — ' + s.blurb, s.x, s.y + s.r + 12);
  }
}

function drawMissionMarker(ctx, step, time) {
  if (!step || step.x === undefined) return;
  const pulse = 1 + Math.sin(time * 4) * 0.12;
  ctx.save();
  ctx.translate(step.x, step.y);
  ctx.strokeStyle = '#ffd873';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, step.r * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,216,115,0.12)';
  ctx.fill();
  // A floating diamond above the marker.
  const bob = Math.sin(time * 3) * 6;
  ctx.fillStyle = '#ffd873';
  ctx.beginPath();
  ctx.moveTo(0, -44 + bob);
  ctx.lineTo(10, -32 + bob);
  ctx.lineTo(0, -20 + bob);
  ctx.lineTo(-10, -32 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawNight(ctx, S, cam, vw, vh, night) {
  if (!night) return;
  const x0 = cam.x - vw / 2;
  const y0 = cam.y - vh / 2;
  ctx.fillStyle = 'rgba(8,12,34,0.42)';
  ctx.fillRect(x0, y0, vw, vh);
  // Headlight cone from the player's car, or a small pool on foot.
  const p = S.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  const reach = p.inCar ? 260 : 120;
  const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, reach);
  grad.addColorStop(0, 'rgba(255,240,180,0.28)');
  grad.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, reach, -0.5, 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTracersAndParticles(ctx, S) {
  for (const t of S.tracers) {
    ctx.strokeStyle = `rgba(255,220,120,${Math.max(0, t.life)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
  }
  for (const p of S.particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// --- HUD -----------------------------------------------------------------

function drawMinimap(ctx, S, W, vw, vh) {
  const mw = 220;
  const mh = 160;
  const mx = vw - mw - 16;
  const my = 16;
  const sx = mw / WORLD.w;
  const sy = mh / WORLD.h;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,18,0.85)';
  roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#2e4a3a';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#2e6f8e';
  ctx.fillRect(mx + SEA_X * sx, my, mw - SEA_X * sx, mh);
  ctx.fillRect(mx, my + MARINA_Y * sy, mw, mh - MARINA_Y * sy);
  ctx.fillStyle = '#e3cd96';
  ctx.fillRect(mx + BEACH_X * sx, my, (SEA_X - BEACH_X) * sx, mh);
  ctx.fillStyle = '#5d8f4e';
  ctx.fillRect(mx + 1400 * sx, my + 850 * sy, 300 * sx, 300 * sy);
  ctx.fillStyle = '#3c3c40';
  for (const rx of ROADS_X) ctx.fillRect(mx + (rx - 4) * sx, my, 8 * sx, mh);
  for (const ry of ROADS_Y) ctx.fillRect(mx, my + (ry - 4) * sy, mw, 8 * sy);
  // Coins left.
  ctx.fillStyle = '#f7c948';
  for (const c of W.coins) {
    if (!c.taken) ctx.fillRect(mx + c.x * sx - 2, my + c.y * sy - 2, 4, 4);
  }
  // Mission marker.
  const step = S.missionStep;
  if (step && step.x !== undefined) {
    ctx.fillStyle = '#ffd873';
    ctx.beginPath();
    ctx.arc(mx + step.x * sx, my + step.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police as flashing dots.
  for (const car of S.cars) {
    if (!car.police) continue;
    ctx.fillStyle = Math.floor(S.time * 4) % 2 ? '#ff4040' : '#4080ff';
    ctx.beginPath();
    ctx.arc(mx + car.x * sx, my + car.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player, always on top.
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(mx + S.player.x * sx, my + S.player.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawHUD(ctx, S, W, vw, vh) {
  const p = S.player;
  // Wanted stars, top-left.
  for (let i = 0; i < 5; i++) {
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = i < S.wanted ? '#ffd23c' : 'rgba(255,255,255,0.25)';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText('★', 18 + i * 30, 14);
    ctx.fillText('★', 18 + i * 30, 14);
  }
  // Cash and district, under the stars.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#7de07d';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 4;
  ctx.strokeText('$' + p.cash.toLocaleString('en-US'), 18, 48);
  ctx.fillText('$' + p.cash.toLocaleString('en-US'), 18, 48);
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.strokeText(S.district, 18, 78);
  ctx.fillText(S.district, 18, 78);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('☀ ' + S.coinsCollected + '/8  •  Missions ' + S.missionsDone + '/6', 18, 100);
  // Clock.
  const hh = Math.floor(S.hours) % 24;
  const mm = Math.floor((S.hours % 1) * 60);
  const clock = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 4;
  ctx.strokeText(clock, vw - 18, 186);
  ctx.fillText(clock, vw - 18, 186);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(isNight(S.hours) ? 'Night in Solmar Bay' : 'Day in Solmar Bay', vw - 18, 212);
  // Health and armour, bottom-left.
  const bx = 18;
  const by = vh - 66;
  ctx.textAlign = 'left';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('HEALTH', bx, by);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(bx, by + 16, 200, 12);
  ctx.fillStyle = p.health > 30 ? '#58c96b' : '#d23c3c';
  ctx.fillRect(bx, by + 16, 200 * Math.max(0, p.health / 100), 12);
  ctx.fillText('ARMOUR', bx, by + 36);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(bx, by + 52, 200, 12);
  ctx.fillStyle = '#5aa8e8';
  ctx.fillRect(bx, by + 52, 200 * Math.max(0, p.armour / 100), 12);
  // Weapon and ammo, bottom-right.
  ctx.textAlign = 'right';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 3;
  const weaponText = p.weapon === 'pistol' ? 'PISTOL  ' + p.ammo : 'FISTS';
  ctx.strokeText(weaponText, vw - 18, vh - 66);
  ctx.fillText(weaponText, vw - 18, vh - 66);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('[Q] switch weapon   [R] radio ' + (S.radioOn ? 'ON' : 'off'), vw - 18, vh - 44);
  // Speedometer, when driving.
  if (p.inCar && p.car) {
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.strokeText(Math.round(Math.abs(p.car.speed) * 0.18) + ' mph', vw - 18, vh - 122);
    ctx.fillText(Math.round(Math.abs(p.car.speed) * 0.18) + ' mph', vw - 18, vh - 122);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(CAR_TYPES[p.car.type].name, vw - 18, vh - 88);
  }
  // Mission tracker, top-centre.
  if (S.mission) {
    const m = S.mission;
    const step = S.missionStep;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10,14,18,0.72)';
    const tw = 460;
    roundRect(ctx, vw / 2 - tw / 2, 14, tw, 58, 8);
    ctx.fill();
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#ffd873';
    ctx.fillText('◆ ' + m.name + '  •  $' + m.reward, vw / 2, 24);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(step ? step.text : '', vw / 2, 46);
  }
  // Context prompt, bottom-centre.
  if (S.prompt) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 4;
    ctx.strokeText(S.prompt, vw / 2, vh - 24);
    ctx.fillText(S.prompt, vw / 2, vh - 24);
  }
  // Briefing banner from Tía Carmen.
  if (S.banner && S.bannerT > 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10,14,18,0.85)';
    roundRect(ctx, vw / 2 - 330, vh / 2 - 92, 660, 84, 10);
    ctx.fill();
    ctx.strokeStyle = '#ffd873';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#ffd873';
    ctx.fillText('TÍA CARMEN', vw / 2, vh / 2 - 72);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#fff';
    wrapText(ctx, S.banner, vw / 2, vh / 2 - 50, 620, 18);
  }
  drawMinimap(ctx, S, W, vw, vh);
}

function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, cx, y + i * lineH));
}

// --- Screens ---------------------------------------------------------------

function drawTitle(ctx, S, vw, vh) {
  ctx.fillStyle = 'rgba(8,10,16,0.72)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd873';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLMAR BAY', vw / 2, vh / 2 - 130);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('An open-world crime story in the spirit of GTA 6', vw / 2, vh / 2 - 92);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Rico Vega is back in town. Tía Carmen has work. The SBPD has other ideas.', vw / 2, vh / 2 - 62);
  ctx.font = 'bold 17px sans-serif';
  ctx.fillStyle = '#7de07d';
  ctx.fillText('Press ENTER to start' + (S.hasSave ? '   •   [C] continue your save' : ''), vw / 2, vh / 2 - 10);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('WASD / arrows — move & drive   •   Mouse — aim   •   Click — shoot / punch', vw / 2, vh / 2 + 30);
  ctx.fillText('E — enter car / interact   •   Q — switch weapon   •   R — Radio Solmar   •   P — pause', vw / 2, vh / 2 + 54);
  ctx.fillText('6 missions  •  6 cars to steal  •  8 Sun Coins ($250 each)  •  Wanted 0–5 stars', vw / 2, vh / 2 + 84);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Original game — no Rockstar / GTA names, characters, art or music.', vw / 2, vh - 24);
}

function drawPause(ctx, vw, vh) {
  ctx.fillStyle = 'rgba(8,10,16,0.6)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('PAUSED', vw / 2, vh / 2 - 20);
  ctx.font = '16px sans-serif';
  ctx.fillText('P or Esc to keep playing', vw / 2, vh / 2 + 16);
}

function drawEnd(ctx, S, vw, vh, title, color, sub) {
  ctx.fillStyle = 'rgba(8,10,16,0.7)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(title, vw / 2, vh / 2 - 30);
  ctx.fillStyle = '#fff';
  ctx.font = '17px sans-serif';
  ctx.fillText(sub, vw / 2, vh / 2 + 10);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#7de07d';
  ctx.fillText('Press ENTER to get back on the streets', vw / 2, vh / 2 + 48);
}

// --- Main entry ------------------------------------------------------------

export function render(ctx, S, W, vw, vh) {
  const cam = S.camera;
  ctx.save();
  // World space: the camera centres on the player.
  ctx.translate(vw / 2 - cam.x, vh / 2 - cam.y);
  drawGround(ctx, cam, vw, vh, S.time);
  drawRoads(ctx, cam, vw, vh);
  drawPark(ctx, W, cam, vw, vh);
  drawPiersAndBoats(ctx, W, isNight(S.hours));
  drawBuildings(ctx, W, cam, vw, vh, isNight(S.hours), S.time);
  drawPalms(ctx, W, cam, vw, vh);
  drawServices(ctx, W, cam, vw, vh);
  drawCoins(ctx, W, cam, vw, vh, S.time);
  drawMissionMarker(ctx, S.missionStep, S.time);
  for (const car of S.cars) {
    if (car.hidden) continue;
    drawCar(ctx, car);
  }
  for (const ped of S.peds) drawPerson(ctx, ped, false, isNight(S.hours));
  for (const off of S.officers) drawPerson(ctx, off, false, isNight(S.hours));
  if (!S.player.inCar) drawPerson(ctx, S.player, true, isNight(S.hours));
  drawTracersAndParticles(ctx, S);
  drawNight(ctx, S, cam, vw, vh, isNight(S.hours));
  drawLamps(ctx, W, cam, vw, vh, isNight(S.hours));
  ctx.restore();
  // HUD and screens live in screen space.
  if (S.mode !== 'title') drawHUD(ctx, S, W, vw, vh);
  if (S.mode === 'title') drawTitle(ctx, S, vw, vh);
  else if (S.mode === 'paused') drawPause(ctx, vw, vh);
  else if (S.mode === 'busted') drawEnd(ctx, S, vw, vh, 'BUSTED', '#5aa8e8', 'The SBPD took you in. You lost $100 and your heat — but not your nerve.');
  else if (S.mode === 'wasted') drawEnd(ctx, S, vw, vh, 'WASTED', '#d23c3c', 'Solmar General patched you up. You lost $150. Tía Carmen is not impressed.');
  else if (S.mode === 'complete') {
    ctx.fillStyle = 'rgba(8,10,16,0.7)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd873';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText('THE SOLMAR SCORE', vw / 2, vh / 2 - 60);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('All six missions done. Rico Vega owns this town now.', vw / 2, vh / 2 - 20);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#7de07d';
    ctx.fillText('Press ENTER to keep cruising Solmar Bay', vw / 2, vh / 2 + 20);
  }
}
