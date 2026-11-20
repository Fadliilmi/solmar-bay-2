// shots.js — deterministic staged scenes for the screenshots, one per
// ?shot= name, always with &seed=1. Each scene puts Rico, the cars, the
// police and the mission exactly where the shot needs them, then the normal
// game loop takes over, so the picture is the game itself playing — never
// a mock-up, never an edit. The same seed always stages the same scene.

import { MISSIONS, CAR_TYPES } from './config.js';

function setMission(S, missionIndex, stepIndex) {
  S.missionIndex = missionIndex;
  S.mission = MISSIONS[missionIndex];
  S.missionStepIndex = stepIndex;
  S.missionStep = S.mission.steps[stepIndex];
  S.fightLeft = S.missionStep.kind === 'fight' ? S.missionStep.count : 0;
  S.holdT = 0;
  S.banner = '';
  S.bannerT = 0;
}

function findParked(S, type) {
  return S.cars.find((c) => c.parked && (!type || c.type === type));
}

function driveCar(S, car, x, y, angle, speed) {
  car.parked = false;
  car.traffic = false;
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = speed;
  const p = S.player;
  p.inCar = true;
  p.car = car;
  p.x = x;
  p.y = y;
  p.angle = angle;
  p.speed = speed;
}

function addPolice(S, x, y, angle, speed) {
  S.cars.push({
    x, y, angle, speed,
    type: 'vela', color: '#1d2f4a', traffic: false, parked: false,
    police: true, siren: true, sirenT: 0, route: [], routeIdx: 0, cruise: 520, bounceT: 0,
  });
}

function addRival(S, x, y) {
  S.peds.push({
    x, y, angle: Math.PI, speed: 0,
    color: '#8a2f2f', fleeing: false, rival: true,
    health: 60, maxHealth: 60, weapon: 'pistol',
    wanderT: 0, tx: x, ty: y, shootT: 0.4,
  });
}

function snapCamera(S) {
  S.camera.x = S.player.x;
  S.camera.y = S.player.y;
}

export function applyShot(S, world, name, seed) {
  const p = S.player;
  p.health = 100;
  p.armour = 60;
  p.weapon = 'pistol';
  p.ammo = 48;
  S.coinsCollected = 3;
  world.coins[0].taken = true;
  world.coins[2].taken = true;
  world.coins[4].taken = true;
  S.missionsDone = 0;

  if (name === 'cover') {
    // A car chase through Downtown: Rico in the red Cometa GT, two SBPD
    // patrol cars on his tail, the bank job on and four stars burning.
    setMission(S, 5, 2);
    S.missionsDone = 5;
    p.cash = 2350;
    S.hours = 15.5;
    S.wanted = 4;
    const gt = S.cars.find((c) => c.missionCar) || findParked(S, 'cometa');
    driveCar(S, gt, 1050, 1200, 0, 380);
    S.shotDrive = true;
    addPolice(S, 850, 1194, 0, 430);
    addPolice(S, 790, 1232, 0, 420);
    p.angle = 0;
  } else if (name === 'street') {
    // Rico on foot in Downtown, first mission: a Vela Sedan waits at the
    // curb, Tía Carmen's first job on the tracker.
    setMission(S, 0, 0);
    p.cash = 100;
    S.hours = 10;
    S.wanted = 0;
    p.weapon = 'fists';
    const vela = findParked(S, 'vela');
    if (vela) {
      // Park it on a Downtown curb, right where Rico walks.
      vela.x = 1360;
      vela.y = 1200;
      vela.angle = 0;
      p.x = 1290;
      p.y = 1200;
    } else {
      p.x = 1300;
      p.y = 1200;
    }
    p.inCar = false;
    p.car = null;
    p.angle = 0;
  } else if (name === 'beach') {
    // A shootout on the Beachfront sand at golden hour: Rico with his
    // pistol, Vipers closing in, two stars and the Beach Brawl on.
    setMission(S, 4, 0);
    S.missionsDone = 4;
    p.cash = 1400;
    S.hours = 18.5;
    S.wanted = 2;
    p.x = 3160;
    p.y = 900;
    p.inCar = false;
    p.car = null;
    p.angle = angleTo(p.x, p.y, 3260, 860);
    addRival(S, 3260, 860);
    addRival(S, 3240, 980);
    addRival(S, 3100, 820);
    // A beachgoer fleeing the gunfire sells the chaos.
    const ped = S.peds.find((x) => !x.rival);
    if (ped) {
      ped.x = 3180;
      ped.y = 760;
      ped.fleeing = true;
      ped.fleeX = 3050;
      ped.fleeY = 600;
    }
  } else if (name === 'night') {
    // A night drive down to the marina: headlights on, windows lit,
    // the parcel run's pier marker waiting at the end of the road.
    setMission(S, 1, 1);
    S.missionsDone = 1;
    p.cash = 850;
    S.hours = 22.5;
    S.wanted = 0;
    S.radioOn = true;
    // East along the marina road: the water on the right, the piers ahead.
    const vela = findParked(S, 'vela') || findParked(S);
    driveCar(S, vela, 1200, 2100, 0, 300);
    S.shotDrive = true;
  } else {
    // Unknown shot name: plain Downtown noon, no staging.
    setMission(S, 0, 0);
    S.hours = 12;
    S.wanted = 0;
    p.x = 1300;
    p.y = 1200;
  }
  snapCamera(S);
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
