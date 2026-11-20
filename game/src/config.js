// config.js — every fixed number and name in Solmar Bay lives here, so the
// rest of the game reads like a story instead of a spreadsheet. Change a
// value here and the whole city follows: car speeds, mission payouts,
// district borders, the price of a spray job.

export const WORLD = { w: 3600, h: 2600 };

// The road grid. Vertical roads run top to bottom, horizontal roads left to
// right; every intersection is a node of the driving graph.
export const ROADS_X = [300, 800, 1300, 1800, 2300, 2800];
export const ROADS_Y = [300, 750, 1200, 1650, 2100];
export const ROAD_HALF = 34;

// The sea eats the east edge, the marina water the south edge.
export const SEA_X = 3300; // water starts here, beach sand runs up to it
export const BEACH_X = 3050; // sand starts here
export const MARINA_Y = 2350; // water starts here along the south

export const DISTRICTS = [
  { name: 'Old Town', x: 0, y: 0, w: 800, h: 1650, ground: '#8a7a5c' },
  { name: 'Suburbs', x: 800, y: 0, w: 2800, h: 750, ground: '#7d9b5e' },
  { name: 'Downtown', x: 800, y: 750, w: 1500, h: 900, ground: '#6f6f74' },
  { name: 'Palm Park', x: 1400, y: 850, w: 300, h: 300, ground: '#5d8f4e' },
  { name: 'Industrial', x: 2300, y: 1200, w: 750, h: 900, ground: '#7a6a55' },
  { name: 'Beachfront', x: 2800, y: 0, w: 800, h: 2600, ground: '#e3cd96' },
  { name: 'Marina', x: 0, y: 2100, w: 3600, h: 500, ground: '#5f7d8c' },
];

export function districtAt(x, y) {
  if (x >= 1400 && x < 1700 && y >= 850 && y < 1150) return 'Palm Park';
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return 'Solmar Bay';
}

// Six stealable cars. topSpeed is px/s, accel px/s^2, grip how fast the car
// turns toward the wheel, body is the top-down footprint in px.
export const CAR_TYPES = {
  vela: { name: 'Vela Sedan', topSpeed: 430, accel: 300, grip: 2.6, len: 52, wid: 26, color: '#3e6fb0', price: 0 },
  cometa: { name: 'Cometa GT', topSpeed: 560, accel: 420, grip: 3.4, len: 54, wid: 25, color: '#c22f2f', price: 0 },
  rancho: { name: 'Rancho Pickup', topSpeed: 380, accel: 260, grip: 2.2, len: 56, wid: 28, color: '#7a5a34', price: 0 },
  brisa: { name: 'Brisa Convertible', topSpeed: 500, accel: 360, grip: 3.1, len: 50, wid: 25, color: '#e8b73c', price: 0 },
  carguero: { name: 'Carguero Van', topSpeed: 340, accel: 220, grip: 1.9, len: 60, wid: 29, color: '#5e7d6a', price: 0 },
  bajito: { name: 'Bajito Lowrider', topSpeed: 400, accel: 280, grip: 2.4, len: 52, wid: 26, color: '#7b3fa0', price: 0 },
};
export const CAR_TYPE_KEYS = Object.keys(CAR_TYPES);

// City services. Stand in the ring and press E.
export const SERVICES = {
  ammo: { name: 'Ammo-Nation', x: 1380, y: 830, r: 70, blurb: 'Pistol ammo $40 / 24 rounds' },
  spray: { name: "Pay 'n Spray", x: 2400, y: 1340, r: 80, blurb: 'Respray $50 — clears wanted, fixes car' },
  hospital: { name: 'Solmar General Hospital', x: 880, y: 1740, r: 80, blurb: 'Heal up — free, walk in' },
  safehouse: { name: 'Safehouse', x: 390, y: 390, r: 80, blurb: 'Rico\'s place — progress saves here' },
  bank: { name: 'Solmar Bank', x: 1720, y: 1330, r: 90, blurb: 'The Solmar Score target' },
};

// Eight hidden Sun Coins, $250 each. Reachable on foot: sidewalks, sand,
// park grass, pier boards, never inside a building.
export const COIN_SPOTS = [
  { x: 3180, y: 620, hint: 'Beachfront sand, north end' },
  { x: 1560, y: 2500, hint: 'End of the marina pier' },
  { x: 1640, y: 900, hint: 'Palm Park, by the pond' },
  { x: 2620, y: 1520, hint: 'Industrial yard' },
  { x: 2500, y: 420, hint: 'Suburbs, behind the hedges' },
  { x: 520, y: 1020, hint: 'Old Town alley' },
  { x: 2050, y: 1450, hint: 'Downtown, behind the bank' },
  { x: 950, y: 2250, hint: 'Marina walk, west end' },
];
export const COIN_VALUE = 250;

// The story, in order. Each mission is a list of steps; a step is done when
// the player reaches its marker, or defeats its targets, or holds E long
// enough at its marker. Tía Carmen briefs each one.
export const MISSIONS = [
  {
    id: 'first-wheels',
    name: 'First Wheels',
    reward: 150,
    briefing: 'Tía Carmen: Rico, you are back and broke. Steal wheels — any car — and bring it to the Marina overlook. No cops, no noise.',
    steps: [
      { kind: 'steal', text: 'Steal any car (walk up and press E)' },
      { kind: 'goto', x: 1500, y: 2280, r: 90, text: 'Drive to the Marina overlook' },
    ],
  },
  {
    id: 'parcel-run',
    name: 'Parcel Run',
    reward: 200,
    briefing: 'Tía Carmen: A package waits at Ammo-Nation. Pick it up, then run it down to the pier. The buyer does not like waiting.',
    steps: [
      { kind: 'goto', x: 1380, y: 830, r: 80, text: 'Pick up the package at Ammo-Nation' },
      { kind: 'goto', x: 1560, y: 2400, r: 80, text: 'Deliver it to the marina pier' },
    ],
  },
  {
    id: 'shakedown',
    name: 'Shakedown',
    reward: 300,
    briefing: 'Tía Carmen: The Vipers are taxing my drivers in Industrial. Go remind them whose streets these are. Bring fists or bring iron.',
    steps: [
      { kind: 'fight', x: 2620, y: 1520, r: 220, count: 3, text: 'Deal with the Vipers in Industrial (0/3)' },
    ],
  },
  {
    id: 'hot-wheels',
    name: 'Hot Wheels',
    reward: 250,
    briefing: 'Tía Carmen: A red Cometa GT is parked in Downtown, keys in it, owner asleep. Take it to Pay \'n Spray — new paint, new plates, new life.',
    steps: [
      { kind: 'steal-type', type: 'cometa', text: 'Steal the red Cometa GT in Downtown' },
      { kind: 'goto', x: 2400, y: 1340, r: 90, text: 'Take it to Pay \'n Spray' },
    ],
  },
  {
    id: 'beach-brawl',
    name: 'Beach Brawl',
    reward: 400,
    briefing: 'Tía Carmen: The Vipers came back, on my beach, with guns. End it on the sand, Rico. Nobody taxes Solmar Bay.',
    steps: [
      { kind: 'fight', x: 3180, y: 900, r: 260, count: 4, text: 'Clear the Vipers off Beachfront (0/4)' },
    ],
  },
  {
    id: 'solmar-score',
    name: 'The Solmar Score',
    reward: 1000,
    briefing: 'Tía Carmen: The big one. Solmar Bank, Downtown, midday. Walk in, take the vault cash, and run — the whole SBPD will be on you. Bring it home to the safehouse.',
    steps: [
      { kind: 'goto', x: 1720, y: 1330, r: 90, text: 'Reach Solmar Bank, Downtown' },
      { kind: 'hold', x: 1720, y: 1330, r: 90, hold: 3, text: 'Hold E — crack the vault (3s)' },
      { kind: 'goto', x: 390, y: 390, r: 90, text: 'Escape to the safehouse — wanted level 4!' },
    ],
  },
];

export const PLAYER = {
  walkSpeed: 190,
  runSpeed: 260,
  radius: 14,
  maxHealth: 100,
  maxArmour: 100,
};

export const WANTED = {
  maxStars: 5,
  decayPerSec: 0.05, // stars fall slowly when quiet
  steal: 1,
  kill: 1,
  shootNearPolice: 1,
};

// The day runs 24 game-hours in 12 real minutes; night is 20:00–06:00.
export const CLOCK = { startHour: 10, hoursPerSec: 24 / 720 };

export const SAVE_KEY = 'solmar-bay-save-v1';

export const PALETTE = {
  grass: '#6f9a52',
  sand: '#e3cd96',
  sea: '#2e6f8e',
  seaDeep: '#245a75',
  road: '#3c3c40',
  roadLine: '#d8c95a',
  sidewalk: '#9a9a92',
  park: '#5d8f4e',
  pond: '#3f7d9e',
  buildingRoof: '#8a6f5c',
  hud: '#101418',
};
