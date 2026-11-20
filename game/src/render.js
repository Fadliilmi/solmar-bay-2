// Solmar Bay's renderer: the whole top-down city, its cars and people, the
// day/night lighting, and the HUD with its live minimap — all drawn on one
// canvas, with nothing loaded from the network.

import {
  VIEW_W, VIEW_H, WORLD_W, WORLD_H, ROAD_X, ROAD_Y, ROAD_W,
  WATER_X, SAND_X, DISTRICTS, SERVICES, PALETTE,
} from './config.js';

/** Night falls between 20:00 and 06:00; this is 0 by day and 1 at midnight. */
export function nightFactor(clockMin) {
  const h = clockMin / 60;
  if (h >= 20 || h < 5) return 1;
  if (h >= 19) return 20 - h;
  if (h >= 5 && h < 6) return h - 5;
  return 0;
}

/** Format game minutes as a 24-hour clock string. */
export function clockString(clockMin) {
  const h = Math.floor(clockMin / 60) % 24;
  const m = Math.floor(clockMin % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** One car from above: body, roof, windows, wheels, and police lights. */
export function drawCar(ctx, x, y, angle, model, color, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const len = model.len, wid = model.wid;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, -len / 2 + 3, -wid / 2 + 3, len, wid, 8);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#16181f';
  for (const [wx, wy] of [[-len * 0.32, -wid / 2 - 2], [len * 0.32, -wid / 2 - 2], [-len * 0.32, wid / 2 - 2], [len * 0.32, wid / 2 - 2]]) {
    ctx.fillRect(wx, wy, 12, 5);
  }
  // Body.
  ctx.fillStyle = color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 8);
  ctx.fill();
  // Windows and roof.
  ctx.fillStyle = '#1d2733';
  roundRect(ctx, -len * 0.18, -wid / 2 + 4, len * 0.22, wid - 8, 4);
  ctx.fill();
  ctx.fillStyle = model.roof || '#d8d2c2';
  roundRect(ctx, -len * 0.42, -wid / 2 + 5, len * 0.2, wid - 10, 4);
  ctx.fill();
  // Headlights when the lights are on.
  if (opts.lights) {
    ctx.fillStyle = '#fff6c9';
    ctx.fillRect(len / 2 - 2, -wid / 2 + 3, 4, 6);
    ctx.fillRect(len / 2 - 2, wid / 2 - 9, 4, 6);
  }
  // Police light bar, flashing red and blue.
  if (opts.police) {
    const phase = Math.floor(opts.time * 6) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2e2e' : '#2e6bff';
    ctx.fillRect(-6, -wid / 2 + 2, 12, 7);
    ctx.fillStyle = phase ? '#2e6bff' : '#ff2e2e';
    ctx.fillRect(-6, wid / 2 - 9, 12, 7);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SBPD', 0, 3);
  }
  ctx.restore();
}

/** One person from above: body, head, facing nose, and a gun when armed. */
export function drawPerson(ctx, x, y, angle, color, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = opts.skin || '#d8a878';
  ctx.beginPath();
  ctx.arc(Math.cos(angle) * 3, Math.sin(angle) * 3, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#22242e';
  ctx.beginPath();
  ctx.arc(Math.cos(angle) * 11, Math.sin(angle) * 11, 2.5, 0, Math.PI * 2);
  ctx.fill();
  if (opts.armed) {
    ctx.strokeStyle = '#1a1c22';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 10, Math.sin(angle) * 10);
    ctx.lineTo(Math.cos(angle) * 20, Math.sin(angle) * 20);
    ctx.stroke();
  }
  if (opts.police) {
    ctx.fillStyle = '#2e4a8a';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 7px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 2.5);
  }
  ctx.restore();
}

/** Draw the whole game frame: world, lighting, HUD, and screen overlays. */
export function drawGame(ctx, v) {
  const cam = v.camera;
  const night = nightFactor(v.clockMin);
  const inView = (x, y, m = 80) => x > cam.x - m && x < cam.x + VIEW_W + m && y > cam.y - m && y < cam.y + VIEW_H + m;

  ctx.save();
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);

  // ---- Ground: one flat colour per district. ----
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(d.x - cam.x, d.y - cam.y, d.w, d.h);
  }

  // ---- Ocean, beach, park pond. ----
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(0 - cam.x, 0 - cam.y, WATER_X, WORLD_H);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(40 - cam.x, 0 - cam.y, WATER_X - 40, WORLD_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let y = 0; y < WORLD_H; y += 90) {
    ctx.beginPath();
    ctx.moveTo(150 - cam.x, y - cam.y);
    ctx.quadraticCurveTo(120 - cam.x, y + 22 - cam.y, 150 - cam.x, y + 44 - cam.y);
    ctx.stroke();
  }
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(WATER_X - cam.x, 0 - cam.y, SAND_X - WATER_X, WORLD_H);
  ctx.fillStyle = 'rgba(120,90,40,0.5)';
  for (let i = 0; i < 240; i += 1) {
    const sx = WATER_X + ((i * 53) % (SAND_X - WATER_X));
    const sy = (i * 97) % WORLD_H;
    ctx.fillRect(sx - cam.x, sy - cam.y, 2, 2);
  }
  ctx.fillStyle = PALETTE.pond;
  ctx.beginPath();
  ctx.ellipse(2800 - cam.x, 1100 - cam.y, 200, 130, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a7a5a';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.ellipse(2800 - cam.x, 1100 - cam.y, 206, 136, 0, 0, Math.PI * 2);
  ctx.stroke();

  // ---- Roads, sidewalks, lane dashes, crosswalks. ----
  for (const rx of ROAD_X) {
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(rx - ROAD_W / 2 - 22 - cam.x, -cam.y, ROAD_W + 44, WORLD_H);
    ctx.fillStyle = PALETTE.road;
    ctx.fillRect(rx - ROAD_W / 2 - cam.x, -cam.y, ROAD_W, WORLD_H);
  }
  for (const ry of ROAD_Y) {
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(-cam.x, ry - ROAD_W / 2 - 22 - cam.y, WORLD_W, ROAD_W + 44);
    ctx.fillStyle = PALETTE.road;
    ctx.fillRect(-cam.x, ry - ROAD_W / 2 - cam.y, WORLD_W, ROAD_W);
  }
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (const rx of ROAD_X) {
    ctx.beginPath();
    ctx.moveTo(rx - cam.x, -cam.y);
    ctx.lineTo(rx - cam.x, WORLD_H - cam.y);
    ctx.stroke();
  }
  for (const ry of ROAD_Y) {
    ctx.beginPath();
    ctx.moveTo(-cam.x, ry - cam.y);
    ctx.lineTo(WORLD_W - cam.x, ry - cam.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = PALETTE.crosswalk;
  for (const rx of ROAD_X) {
    for (const ry of ROAD_Y) {
      for (let i = -3; i <= 3; i += 1) {
        ctx.fillRect(rx + i * 10 - 4 - cam.x, ry - ROAD_W / 2 - 16 - cam.y, 8, 12);
        ctx.fillRect(rx + i * 10 - 4 - cam.x, ry + ROAD_W / 2 + 4 - cam.y, 8, 12);
      }
    }
  }

  // ---- Marina piers and boats. ----
  ctx.fillStyle = '#8a6a4a';
  for (const p of v.city.piers) ctx.fillRect(p.x - cam.x, p.y - cam.y, p.w, p.h);
  for (const b of v.city.boats) {
    if (!inView(b.x, b.y)) continue;
    ctx.save();
    ctx.translate(b.x - cam.x, b.y - cam.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = '#e8e8e8';
    roundRect(ctx, -b.len / 2, -9, b.len, 18, 8);
    ctx.fill();
    ctx.fillStyle = '#4a90c9';
    ctx.fillRect(-b.len / 4, -6, b.len / 2, 12);
    ctx.restore();
  }

  // ---- District labels on the ground, kept clear of the HUD panels. ----
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'center';
  const hudZone = (x, y) =>
    (x < 350 && y < 280) || (x > 1000 && y < 130) || (x < 280 && y > 540) || (x > 1080 && y > 600);
  for (const d of DISTRICTS) {
    const lx = d.x + d.w / 2 - cam.x, ly = d.y + d.h / 2 - cam.y;
    if (lx > -200 && lx < VIEW_W + 200 && ly > -100 && ly < VIEW_H + 100 && !hudZone(lx, ly)) {
      ctx.fillText(d.name.toUpperCase(), lx, ly);
    }
  }

  // ---- Buildings: roofs with window grids that light up after dark. ----
  for (const b of v.city.buildings) {
    if (!inView(b.x + b.w / 2, b.y + b.h / 2, 200)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x - cam.x + 6, b.y - cam.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(b.x - cam.x + 6, b.y - cam.y + 6, b.w - 12, 10);
    const cw = b.w / b.cols, ch = b.h / b.rows;
    for (let r = 0; r < b.rows; r += 1) {
      for (let c = 0; c < b.cols; c += 1) {
        const lit = b.lit[r * b.cols + c];
        ctx.fillStyle = night > 0.4 && lit ? PALETTE.windowLit : PALETTE.windowDay;
        ctx.fillRect(b.x - cam.x + c * cw + cw * 0.25, b.y - cam.y + r * ch + ch * 0.25, cw * 0.5, ch * 0.5);
      }
    }
    if (b.floors >= 6) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${b.floors}F`, b.x + b.w / 2 - cam.x, b.y + b.h / 2 + 4 - cam.y);
    }
  }

  // ---- Trees and palms. ----
  for (const t of v.city.trees) {
    if (!inView(t.x, t.y)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(t.x + 3 - cam.x, t.y + 4 - cam.y, 12 * t.s, 8 * t.s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.palm ? PALETTE.palm : PALETTE.tree;
    ctx.beginPath();
    ctx.arc(t.x - cam.x, t.y - cam.y, 11 * t.s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(t.x - 3 - cam.x, t.y - 3 - cam.y, 5 * t.s, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Street lamps. ----
  ctx.fillStyle = '#2c2f38';
  for (const l of v.city.lamps) {
    if (!inView(l.x, l.y)) continue;
    ctx.fillRect(l.x - cam.x - 2, l.y - cam.y - 2, 4, 4);
  }

  // ---- Services: a sign and a name each (the name only up close). ----
  const spx = v.playerCar ? v.playerCar.x : v.player.x;
  const spy = v.playerCar ? v.playerCar.y : v.player.y;
  for (const s of SERVICES) {
    if (!inView(s.x, s.y, 120)) continue;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x - cam.x, s.y - cam.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a1c22';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#1a1c22';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    const letter = s.kind === 'shop' ? 'A' : s.kind === 'spray' ? 'S' : s.kind === 'heal' ? 'H' : s.kind === 'save' ? '★' : s.kind === 'bank' ? '$' : 'G';
    ctx.fillText(letter, s.x - cam.x, s.y + 4 - cam.y);
    if (Math.hypot(s.x - spx, s.y - spy) > 520) continue;
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(s.name, s.x - cam.x, s.y + 36 - cam.y);
    ctx.fillText(s.name, s.x - cam.x, s.y + 36 - cam.y);
  }

  // ---- Sun Coins: gold, spinning, with a sparkle ring. ----
  for (const c of v.city.coins) {
    if (c.taken || !inView(c.x, c.y)) continue;
    const pulse = 1 + Math.sin(v.time * 4 + c.id) * 0.15;
    ctx.fillStyle = 'rgba(255,215,80,0.35)';
    ctx.beginPath();
    ctx.arc(c.x - cam.x, c.y - cam.y, 22 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd74f';
    ctx.beginPath();
    ctx.arc(c.x - cam.x, c.y - cam.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a86f00';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#7a4a00';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('$', c.x - cam.x, c.y + 4.5 - cam.y);
  }

  // ---- Cash drops from missions. ----
  for (const p of v.pickups) {
    if (!inView(p.x, p.y)) continue;
    ctx.fillStyle = 'rgba(80,200,120,0.4)';
    ctx.beginPath();
    ctx.arc(p.x - cam.x, p.y - cam.y, 18 + Math.sin(v.time * 5) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3fae62';
    ctx.beginPath();
    ctx.arc(p.x - cam.x, p.y - cam.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('$', p.x - cam.x, p.y + 4 - cam.y);
  }

  // ---- Parked cars, traffic, police, and the player's car. ----
  const lightsOn = night > 0.4;
  for (const c of v.city.parkedCars) {
    if (c.taken || !inView(c.x, c.y)) continue;
    drawCar(ctx, c.x - cam.x, c.y - cam.y, c.angle, c.model, c.color, { lights: false });
  }
  for (const c of v.city.traffic) {
    if (!inView(c.x, c.y)) continue;
    drawCar(ctx, c.x - cam.x, c.y - cam.y, c.angle, c.model, c.color, { lights: lightsOn });
  }
  for (const pc of v.policeCars) {
    if (!inView(pc.x, pc.y)) continue;
    drawCar(ctx, pc.x - cam.x, pc.y - cam.y, pc.angle, pc.model, '#2e4a8a', { lights: true, police: true, time: v.time });
  }
  if (v.playerCar) {
    drawCar(ctx, v.playerCar.x - cam.x, v.playerCar.y - cam.y, v.playerCar.angle, v.playerCar.model, v.playerCar.color, { lights: lightsOn });
  }

  // ---- Pedestrians, rivals, officers, and Rico. ----
  for (const p of v.city.peds) {
    if (p.hp <= 0 || !inView(p.x, p.y)) continue;
    drawPerson(ctx, p.x - cam.x, p.y - cam.y, p.angle, p.color, {});
  }
  for (const r of v.rivals) {
    if (r.hp <= 0 || !inView(r.x, r.y)) continue;
    drawPerson(ctx, r.x - cam.x, r.y - cam.y, r.angle, PALETTE.rival, { armed: true, skin: '#c98a5a' });
    drawBar(ctx, r.x - cam.x - 16, r.y - cam.y - 22, 32, 5, r.hp / 100, '#e84a4a');
  }
  for (const o of v.officers) {
    if (!inView(o.x, o.y)) continue;
    drawPerson(ctx, o.x - cam.x, o.y - cam.y, o.angle, '#2e4a8a', { police: true });
  }
  if (!v.playerCar) {
    // A white ring keeps Rico visible against sand, grass and asphalt alike.
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(v.player.x - cam.x, v.player.y - cam.y, 15, 0, Math.PI * 2);
    ctx.stroke();
    drawPerson(ctx, v.player.x - cam.x, v.player.y - cam.y, v.player.angle, PALETTE.player, { armed: v.player.weapon === 'pistol' });
  }

  // ---- Bullets and particles. ----
  for (const b of v.bullets) {
    ctx.fillStyle = '#ffe98a';
    ctx.beginPath();
    ctx.arc(b.x - cam.x, b.y - cam.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of v.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - cam.x, p.y - cam.y, p.size * a + 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ---- Mission marker: a pulsing beacon over the objective. ----
  if (v.marker) {
    const pulse = 1 + Math.sin(v.time * 5) * 0.2;
    ctx.strokeStyle = '#ffd74f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(v.marker.x - cam.x, v.marker.y - cam.y, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,215,79,0.25)';
    ctx.beginPath();
    ctx.arc(v.marker.x - cam.x, v.marker.y - cam.y, 26 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(v.marker.x - cam.x, v.marker.y - cam.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd74f';
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
  }

  // ---- Night: darken the world, then pool light around lamps and headlights. ----
  if (night > 0.02) {
    ctx.fillStyle = `rgba(8,10,40,${0.5 * night})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalCompositeOperation = 'lighter';
    for (const l of v.city.lamps) {
      if (!inView(l.x, l.y)) continue;
      const g = ctx.createRadialGradient(l.x - cam.x, l.y - cam.y, 2, l.x - cam.x, l.y - cam.y, 70);
      g.addColorStop(0, `rgba(255,205,110,${0.16 * night})`);
      g.addColorStop(1, 'rgba(255,205,110,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(l.x - cam.x, l.y - cam.y, 70, 0, Math.PI * 2);
      ctx.fill();
    }
    if (v.playerCar) {
      const px = v.playerCar.x - cam.x, py = v.playerCar.y - cam.y;
      const a = v.playerCar.angle;
      const hx = px + Math.cos(a) * 150, hy = py + Math.sin(a) * 150;
      const g = ctx.createRadialGradient(px, py, 10, hx, hy, 190);
      g.addColorStop(0, `rgba(255,244,190,${0.22 * night})`);
      g.addColorStop(1, 'rgba(255,244,190,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(px + Math.cos(a + 2.6) * 12, py + Math.sin(a + 2.6) * 12);
      ctx.lineTo(hx + Math.cos(a + 0.5) * 70, hy + Math.sin(a + 0.5) * 70);
      ctx.lineTo(hx + Math.cos(a - 0.5) * 70, hy + Math.sin(a - 0.5) * 70);
      ctx.lineTo(px + Math.cos(a - 2.6) * 12, py + Math.sin(a - 2.6) * 12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  drawHud(ctx, v, night);
  if (v.screen === 'title') drawTitle(ctx, v);
  if (v.screen === 'pause') drawPause(ctx);
  if (v.screen === 'busted' || v.screen === 'wasted') drawEnd(ctx, v);
  ctx.restore();
}

/** A small horizontal bar (health, armour, rival health). */
function drawBar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#333';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, w * Math.min(1, frac)), h);
}

/** The HUD: minimap, stars, cash, clock, bars, weapon, speed, tracker. */
function drawHud(ctx, v, night) {
  if (v.screen === 'title') return;
  const p = v.player;

  // ---- Minimap, top left: the whole city at a glance. ----
  const mx = 14, my = 14, mw = 200, mh = 144;
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(8,10,20,0.82)';
  roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(mx, my, WATER_X * sx, mh);
  ctx.fillStyle = '#e8cf8f';
  ctx.fillRect(mx + WATER_X * sx, my, (SAND_X - WATER_X) * sx, mh);
  ctx.fillStyle = '#7fb069';
  ctx.fillRect(mx + 2500 * sx, my + 700 * sy, 600 * sx, 800 * sy);
  ctx.fillStyle = '#4a90c9';
  ctx.beginPath();
  ctx.ellipse(mx + 2800 * sx, my + 1100 * sy, 200 * sx, 130 * sy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  for (const rx of ROAD_X) {
    ctx.beginPath(); ctx.moveTo(mx + rx * sx, my); ctx.lineTo(mx + rx * sx, my + mh); ctx.stroke();
  }
  for (const ry of ROAD_Y) {
    ctx.beginPath(); ctx.moveTo(mx, my + ry * sy); ctx.lineTo(mx + mw, my + ry * sy); ctx.stroke();
  }
  for (const c of v.city.coins) {
    if (c.taken) continue;
    ctx.fillStyle = '#ffd74f';
    ctx.fillRect(mx + c.x * sx - 2, my + c.y * sy - 2, 4, 4);
  }
  for (const pc of v.policeCars) {
    ctx.fillStyle = '#5a8aff';
    ctx.beginPath(); ctx.arc(mx + pc.x * sx, my + pc.y * sy, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  if (v.marker) {
    const pulse = 3 + Math.sin(v.time * 5) * 1.5;
    ctx.fillStyle = '#ffd74f';
    ctx.beginPath(); ctx.arc(mx + v.marker.x * sx, my + v.marker.y * sy, pulse + 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7a4a00';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  const px = v.playerCar ? v.playerCar.x : p.x;
  const py = v.playerCar ? v.playerCar.y : p.y;
  ctx.save();
  ctx.translate(mx + px * sx, my + py * sy);
  ctx.rotate(v.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR BAY', mx, my + mh + 16);

  // ---- Wanted stars and cash, top right. ----
  ctx.textAlign = 'right';
  ctx.font = 'bold 26px Arial';
  let stars = '';
  for (let i = 0; i < 5; i += 1) stars += i < v.wanted ? '★' : '☆';
  ctx.fillStyle = v.wanted > 0 ? '#ffd74f' : 'rgba(255,255,255,0.55)';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 4;
  ctx.strokeText(stars, VIEW_W - 16, 44);
  ctx.fillText(stars, VIEW_W - 16, 44);
  ctx.font = 'bold 22px Arial';
  ctx.fillStyle = '#7ddc8a';
  ctx.strokeText(`$${v.cash.toLocaleString('en-US')}`, VIEW_W - 16, 76);
  ctx.fillText(`$${v.cash.toLocaleString('en-US')}`, VIEW_W - 16, 76);
  ctx.font = 'bold 16px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.strokeText(`${clockString(v.clockMin)}  ·  Day ${v.day}`, VIEW_W - 16, 100);
  ctx.fillText(`${clockString(v.clockMin)}  ·  Day ${v.day}`, VIEW_W - 16, 100);

  // ---- Mission tracker, under the minimap. ----
  if (v.mission) {
    const tx = 14, ty = 190;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(8,10,20,0.78)';
    roundRect(ctx, tx - 6, ty - 6, 300, 64, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd74f';
    ctx.font = 'bold 15px Arial';
    ctx.fillText(v.mission.title, tx + 6, ty + 16);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '13px Arial';
    ctx.fillText(v.mission.objective, tx + 6, ty + 36);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px Arial';
    const dist = v.mission.distance != null ? `${Math.round(v.mission.distance)}m` : '';
    ctx.fillText(`${dist}   ${v.mission.progress || ''}`, tx + 6, ty + 54);
  }

  // ---- Health, armour, weapon, bottom left. ----
  const bx = 14, by = VIEW_H - 58;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 12px Arial';
  ctx.fillText('HEALTH', bx, by - 26);
  drawBar(ctx, bx + 62, by - 36, 170, 12, p.hp / 100, p.hp > 30 ? '#58c96a' : '#e84a4a');
  ctx.fillText('ARMOUR', bx, by - 6);
  drawBar(ctx, bx + 62, by - 16, 170, 12, p.armour / 100, '#5a8aff');
  ctx.font = 'bold 16px Arial';
  ctx.fillStyle = '#fff';
  const weapon = p.weapon === 'pistol' ? `PISTOL  ${p.ammo}` : 'FISTS';
  ctx.fillText(weapon, bx, by + 22);
  ctx.font = '12px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText(p.weapon === 'pistol' ? 'Q — fists' : 'Q — pistol (needs ammo)', bx + 120, by + 22);

  // ---- Speedometer, bottom right, while driving. ----
  if (v.playerCar) {
    const mph = Math.round(Math.abs(v.playerCar.speed) * 0.16);
    ctx.textAlign = 'right';
    ctx.font = 'bold 34px Arial';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 5;
    ctx.strokeText(`${mph}`, VIEW_W - 70, VIEW_H - 24);
    ctx.fillText(`${mph}`, VIEW_W - 70, VIEW_H - 24);
    ctx.font = 'bold 13px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('MPH', VIEW_W - 22, VIEW_H - 24);
    ctx.fillText(v.playerCar.model.name, VIEW_W - 16, VIEW_H - 52);
  }

  // ---- Radio state. ----
  ctx.textAlign = 'right';
  ctx.font = 'bold 12px Arial';
  ctx.fillStyle = v.radioOn ? '#7ddc8a' : 'rgba(255,255,255,0.45)';
  ctx.fillText(v.radioOn ? '♪ RADIO SOLMAR' : 'R — Radio Solmar', VIEW_W - 16, VIEW_H - 84);

  // ---- Briefing bar, bottom centre. ----
  if (v.briefing && v.time < v.briefing.until) {
    const text = v.briefing.text;
    ctx.font = '15px Arial';
    const w = Math.min(860, ctx.measureText(text).width + 36);
    ctx.fillStyle = 'rgba(8,10,20,0.85)';
    roundRect(ctx, (VIEW_W - w) / 2, VIEW_H - 132, w, 44, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd74f';
    ctx.textAlign = 'center';
    ctx.fillText(text, VIEW_W / 2, VIEW_H - 104);
  }

  // ---- Interaction prompt, above the briefing. ----
  if (v.prompt) {
    ctx.font = 'bold 15px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 4;
    ctx.strokeText(v.prompt, VIEW_W / 2, VIEW_H - 148);
    ctx.fillText(v.prompt, VIEW_W / 2, VIEW_H - 148);
  }

  // ---- Toasts, top centre. ----
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px Arial';
  v.toasts.forEach((t, i) => {
    const a = Math.max(0, Math.min(1, (t.until - v.time) / 0.5));
    ctx.globalAlpha = a;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 4;
    ctx.strokeText(t.text, VIEW_W / 2, 130 + i * 22);
    ctx.fillText(t.text, VIEW_W / 2, 130 + i * 22);
  });
  ctx.globalAlpha = 1;

  // ---- Mission complete banner. ----
  if (v.banner && v.time < v.banner.until) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 34px Arial';
    ctx.fillStyle = '#ffd74f';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 6;
    ctx.strokeText(v.banner.text, VIEW_W / 2, 250);
    ctx.fillText(v.banner.text, VIEW_W / 2, 250);
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = '#7ddc8a';
    ctx.strokeText(v.banner.sub || '', VIEW_W / 2, 282);
    ctx.fillText(v.banner.sub || '', VIEW_W / 2, 282);
  }
}

/** The title screen: logo, story line, controls, and the save line. */
function drawTitle(ctx, v) {
  ctx.fillStyle = 'rgba(5,8,20,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd74f';
  ctx.font = 'bold 92px Arial';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 8;
  ctx.strokeText('SOLMAR BAY', VIEW_W / 2, 210);
  ctx.fillText('SOLMAR BAY', VIEW_W / 2, 210);
  ctx.fillStyle = '#fff';
  ctx.font = 'italic 22px Arial';
  ctx.fillText('An open-world crime story — back in town, back in trouble.', VIEW_W / 2, 256);
  ctx.font = '16px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Rico Vega is home. Tía Carmen has the work: six missions, seven districts,', VIEW_W / 2, 310);
  ctx.fillText('six cars to steal, 8 hidden Sun Coins, and the SBPD on every corner.', VIEW_W / 2, 334);
  const lines = [
    'WASD / arrows — move & drive      Mouse — aim      Click — shoot / punch',
    'E — enter a car / use a service      Q — fists / pistol      R — Radio Solmar',
    'P / Esc — pause      Missions, wanted stars and cash save automatically',
  ];
  ctx.font = '15px Arial';
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 396 + i * 26));
  if (v.saveInfo) {
    ctx.fillStyle = '#7ddc8a';
    ctx.font = 'bold 15px Arial';
    ctx.fillText(v.saveInfo, VIEW_W / 2, 500);
  }
  const blink = Math.floor(v.time * 2) % 2 === 0;
  if (blink) {
    ctx.fillStyle = '#ffd74f';
    ctx.font = 'bold 26px Arial';
    ctx.fillText('PRESS ENTER TO START', VIEW_W / 2, 580);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '13px Arial';
  ctx.fillText('An original game. Nothing from Rockstar Games or any other commercial game.', VIEW_W / 2, 660);
}

function drawPause(ctx) {
  ctx.fillStyle = 'rgba(5,8,20,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 52px Arial';
  ctx.fillText('PAUSED', VIEW_W / 2, 340);
  ctx.font = '18px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('P or Esc to keep playing — progress is saved at the safehouse', VIEW_W / 2, 384);
}

function drawEnd(ctx, v) {
  ctx.fillStyle = 'rgba(20,4,8,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = v.screen === 'busted' ? '#5a8aff' : '#e84a4a';
  ctx.font = 'bold 72px Arial';
  ctx.fillText(v.screen === 'busted' ? 'BUSTED!' : 'WASTED', VIEW_W / 2, 330);
  ctx.fillStyle = '#fff';
  ctx.font = '18px Arial';
  ctx.fillText(v.screen === 'busted'
    ? 'The SBPD took you in. You lost some cash — the streets are waiting.'
    : 'Rico went down. The hospital patched him up — for a price.', VIEW_W / 2, 380);
  ctx.fillStyle = '#ffd74f';
  ctx.font = 'bold 22px Arial';
  ctx.fillText('PRESS ENTER TO CONTINUE', VIEW_W / 2, 460);
}
