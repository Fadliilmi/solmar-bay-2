// The screenshot scenes behind ?shot=cover|street|beach|night. Each one plays
// the real rules forward from a fresh seeded world for a fixed number of
// steps, steered by a scripted input, so the frame is what short play really
// looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { ScriptedInput } from './input.js';

/** Stage one named scene on a fresh world, then freeze it for the camera. */
export function stageShot(name, game) {
  const shot = SHOTS[name] || SHOTS.street;
  game.resetWorld(1);
  game.beginPlay();
  game.shotMode = true;
  const input = new ScriptedInput();
  game.input = input;
  shot.setup(game, input);
  const steps = shot.steps || 60;
  for (let i = 0; i < steps; i += 1) {
    shot.drive(game, input, i);
    game.step(STEP, input);
  }
  game.frozen = true;
  if (typeof window !== 'undefined') window.__shotReady = true;
  return name;
}

/** The four scenes: what is staged, and how the autopilot drives it. */
const SHOTS = {
  // A car chase through Downtown: Rico in the Cometa GT, two SBPD cars on
  // his tail, three stars, the bank job already on the tracker.
  cover: {
    steps: 45,
    setup(game) {
      game.setClockMinutes(15 * 60);
      game.setMissionState(5, 0);
      game.setWanted(3);
      game.enterCar('cometa', 1600, 1250, -Math.PI / 2, 360);
      game.addPolice(1600, 1420, -Math.PI / 2, 340);
      game.addPolice(1600, 1540, -Math.PI / 2, 330);
      game.clearTrafficNear(1600, 1200, 520);
      game.clearPedsNear(1600, 1200, 520);
      game.addTrafficNear(1600, 800, 2, -Math.PI / 2, 1600, 400);
      game.showBriefing("TIA CARMEN: This is the one, Rico. Solmar Bay Bank. Hold the lobby — then run.");
    },
    drive(game, input) { input.hold('KeyW'); },
  },
  // Rico on foot in Downtown, first mission, Tía Carmen's briefing on screen.
  street: {
    steps: 24,
    setup(game) {
      game.setClockMinutes(10 * 60);
      game.setMissionState(0, 0);
      game.setWanted(0);
      game.teleportPlayer(1248, 900, Math.PI / 2);
      game.addParkedCar('vela', 1248, 950, Math.PI / 2);
      game.addParkedCar('rancho', 1150, 1170, -Math.PI / 2);
      game.showBriefing("TIA CARMEN: Rico, you're back. No wheels, no work. Take any car on the street.");
    },
    drive() {},
  },
  // A shootout on the Beachfront sand: Rico with the pistol, three Coral Kings.
  beach: {
    steps: 55,
    setup(game, input) {
      game.setClockMinutes(16 * 60 + 30);
      game.setMissionState(2, 1);
      game.setWanted(2);
      game.teleportPlayer(300, 1020, 0);
      game.givePistol(48);
      game.spawnRival(210, 950);
      game.spawnRival(350, 920);
      game.spawnRival(270, 1100);
      game.addPolice(800, 900, Math.PI, 200);
      input.mouseX = 560;
      input.mouseY = 300;
      input.clicked = true;
      game.showBriefing('TIA CARMEN: The Coral Kings think the beach is theirs. Show them it isn\'t.');
    },
    drive(game, input, i) {
      if (i === 6) { input.mouseX = 700; input.mouseY = 280; input.clicked = true; }
      // One last shot as the camera fires, so a bullet is mid-flight.
      if (i === 50) { input.mouseX = 350; input.mouseY = 260; input.clicked = true; }
    },
  },
  // A night drive to the marina: headlights on, the piers ahead, Radio Solmar.
  night: {
    steps: 60,
    setup(game) {
      game.setClockMinutes(22 * 60 + 30);
      game.setMissionState(1, 1);
      game.setWanted(0);
      game.enterCar('brisa', 1100, 2000, Math.PI, 300);
      game.clearTrafficNear(800, 2000, 560);
      game.clearPedsNear(800, 2000, 560);
      game.addTrafficNear(1450, 2000, 2, Math.PI, 400, 2000);
      game.showBriefing('TIA CARMEN: A package for the Marina. Keep it smooth — the SBPD is sniffing.');
    },
    drive(game, input) { input.hold('KeyW'); },
  },
};
