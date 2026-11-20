// Keyboard and mouse for Solmar Bay: one small state object the game loop
// reads each step, plus the screen position of the mouse for aiming.

/** The keys the game listens to (WASD, arrows, E, Q, R, P, Esc, Enter, Space). */
const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ', 'KeyR', 'KeyP',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Enter', 'Escape', 'Space',
]);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.clicked = false;
    canvas.addEventListener('keydown', (e) => this.onKey(e, true));
    canvas.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    canvas.addEventListener('mousemove', (e) => this.onMouse(e));
    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.tabIndex = 0;
  }

  onKey(e, isDown) {
    if (!GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    if (isDown && !this.down.has(e.code)) this.pressed.add(e.code);
    if (isDown) this.down.add(e.code);
    else this.down.delete(e.code);
  }

  onMouse(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    this.mouseY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
  }

  onMouseDown(e) {
    this.onMouse(e);
    if (e.button === 0) {
      this.mouseDown = true;
      this.clicked = true;
    }
  }

  /** True while the key is held. */
  isDown(code) { return this.down.has(code); }

  /** True only on the step the key went down; call once per consumer. */
  wasPressed(code) {
    if (this.pressed.has(code)) { this.pressed.delete(code); return true; }
    return false;
  }

  /** True only on the step the mouse was clicked. */
  wasClicked() {
    if (this.clicked) { this.clicked = false; return true; }
    return false;
  }

  /** The drive axis: -1 back, +1 forward. */
  driveAxis() {
    let a = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) a += 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) a -= 1;
    return a;
  }

  /** The steering axis: -1 left, +1 right. */
  steerAxis() {
    let s = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) s -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) s += 1;
    return s;
  }

  /** The walk vector, normalised, from the movement keys. */
  walkVector() {
    let x = 0, y = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    const len = Math.hypot(x, y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: x / len, y: y / len };
  }

  /** Clear edge-triggered state at the end of a step. */
  endStep() { this.pressed.clear(); }
}

/**
 * A scripted input for the screenshot scenes: the autopilot holds keys so a
 * scene plays itself forward deterministically.
 */
export class ScriptedInput {
  constructor() {
    this.keys = new Set();
    this.mouseX = 640;
    this.mouseY = 360;
    this.mouseDown = false;
    this.clicked = false;
  }
  hold(...codes) { for (const c of codes) this.keys.add(c); }
  release(...codes) { for (const c of codes) this.keys.delete(c); }
  isDown(code) { return this.keys.has(code); }
  wasPressed(code) { return false; }
  wasClicked() { const c = this.clicked; this.clicked = false; return c; }
  driveAxis() {
    let a = 0;
    if (this.keys.has('KeyW')) a += 1;
    if (this.keys.has('KeyS')) a -= 1;
    return a;
  }
  steerAxis() {
    let s = 0;
    if (this.keys.has('KeyA')) s -= 1;
    if (this.keys.has('KeyD')) s += 1;
    return s;
  }
  walkVector() {
    let x = 0, y = 0;
    if (this.keys.has('KeyW')) y -= 1;
    if (this.keys.has('KeyS')) y += 1;
    if (this.keys.has('KeyA')) x -= 1;
    if (this.keys.has('KeyD')) x += 1;
    const len = Math.hypot(x, y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: x / len, y: y / len };
  }
  endStep() {}
}
