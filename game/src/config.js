// Solmar Bay — every number that shapes the city: its size, districts, roads,
// cars, services, hidden coins and the six story missions. No code here reads
// the network; this is plain data the other modules build from.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const WORLD_W = 3600;
export const WORLD_H = 2600;

/** The city runs on a 60 Hz fixed step. */
export const STEP = 1 / 60;

/** Vertical and horizontal road centre lines; the city is a grid of blocks. */
export const ROAD_X = [400, 800, 1200, 1600, 2000, 2400, 2800, 3200];
export const ROAD_Y = [400, 800, 1200, 1600, 2000, 2400];
export const ROAD_W = 68;

/** The ocean hems the west edge; the beach is the sand between it and town. */
export const WATER_X = 150;
export const SAND_X = 420;

export const DISTRICTS = [
  { name: 'Beachfront', x: 0, y: 0, w: 420, h: 2600, ground: '#e8cf8f', label: '#8a6d2f' },
  { name: 'Old Town', x: 420, y: 0, w: 1680, h: 400, ground: '#c9b18c', label: '#6e5732' },
  { name: 'Downtown', x: 420, y: 400, w: 2080, h: 1300, ground: '#9aa0ad', label: '#3c4152' },
  { name: 'Palm Park', x: 2500, y: 700, w: 600, h: 800, ground: '#7fb069', label: '#2f5d23' },
  { name: 'Suburbs', x: 2500, y: 0, w: 1100, h: 700, ground: '#b7c9a3', label: '#4c6440' },
  { name: 'Industrial', x: 2500, y: 1500, w: 1100, h: 1100, ground: '#8d8578', label: '#453f33' },
  { name: 'Marina', x: 0, y: 1900, w: 900, h: 700, ground: '#a8b8c4', label: '#33505e' },
];

/** Which district a point belongs to, for ground colour and building style. */
export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[2];
}

/** The six stealable cars: top speed, acceleration and handling differ. */
export const CAR_MODELS = [
  { id: 'vela', name: 'Vela Sedan', top: 330, accel: 300, grip: 0.92, len: 52, wid: 26, color: '#c94f43', roof: '#e8ddd2' },
  { id: 'cometa', name: 'Cometa GT', top: 470, accel: 380, grip: 0.78, len: 50, wid: 24, color: '#e8b73a', roof: '#22242e' },
  { id: 'rancho', name: 'Rancho Pickup', top: 340, accel: 320, grip: 0.88, len: 56, wid: 27, color: '#4f7a4a', roof: '#d8d2c2' },
  { id: 'brisa', name: 'Brisa Convertible', top: 410, accel: 350, grip: 0.82, len: 50, wid: 25, color: '#4a90c9', roof: '#f2ead8' },
  { id: 'carguero', name: 'Carguero Van', top: 280, accel: 260, grip: 0.95, len: 60, wid: 28, color: '#d8d8d8', roof: '#8a8f98' },
  { id: 'bajito', name: 'Bajito Lowrider', top: 360, accel: 330, grip: 1.0, len: 52, wid: 26, color: '#7a4a9e', roof: '#f2e3c2' },
];

/** City services the player can walk or drive up to and use with E. */
export const SERVICES = [
  { id: 'ammo', name: 'Ammo-Nation', kind: 'shop', x: 1260, y: 740, color: '#e8b73a' },
  { id: 'spray', name: "Pay 'n Spray", kind: 'spray', x: 2360, y: 1660, color: '#4a90c9' },
  { id: 'hospital', name: 'Solmar General Hospital', kind: 'heal', x: 940, y: 1260, color: '#e8e8e8' },
  { id: 'safehouse', name: 'Safehouse', kind: 'save', x: 3060, y: 460, color: '#7fb069' },
  { id: 'bank', name: 'Solmar Bay Bank', kind: 'bank', x: 1760, y: 940, color: '#d8c98a' },
  { id: 'garage', name: "Tia's Garage", kind: 'garage', x: 1140, y: 1560, color: '#c94f43' },
];

/** The 8 hidden Sun Coins: $250 each, scattered across the whole city. */
export const COIN_SPOTS = [
  { x: 260, y: 320, hint: 'Beachfront sand' },
  { x: 96, y: 2150, hint: 'end of the marina pier' },
  { x: 2720, y: 1230, hint: 'Palm Park pond' },
  { x: 3320, y: 1920, hint: 'Industrial yard' },
  { x: 1500, y: 460, hint: 'Old Town plaza' },
  { x: 2120, y: 1320, hint: 'Downtown alley' },
  { x: 3220, y: 320, hint: 'Suburbs garden' },
  { x: 880, y: 2120, hint: 'Marina corner' },
];

export const COIN_VALUE = 250;
export const START_CASH = 120;
export const PISTOL_PRICE = 300;
export const AMMO_PRICE = 50;
export const AMMO_PACK = 24;
export const SPRAY_PRICE = 150;
export const HEAL_PRICE = 100;

/** Wanted heat: how long quiet costs one star, and what each crime adds. */
export const WANTED_DECAY_SECONDS = 45;
export const WANTED_FOR_STEAL = 1;
export const WANTED_FOR_SHOT = 1;
export const WANTED_FOR_KILL = 1;
export const WANTED_FOR_COP_KILL = 2;

/** Rico Vega's story, as Tía Carmen tells it: six missions, each a list of
 *  steps. A step is one job: steal a car, reach a marker, beat a crew,
 *  collect cash drops, hold a spot, or escape to the safehouse. */
export const MISSIONS = [
  {
    id: 'first-wheels', title: 'First Wheels', reward: 200,
    brief: "TIA CARMEN: Rico, you're back. No wheels, no work. Take any car on the street — just don't get caught doing it.",
    steps: [
      { kind: 'steal', text: 'Steal a car (walk up to one, press E)' },
      { kind: 'goto', x: 1140, y: 1560, r: 90, text: "Drive to Tia's Garage" },
    ],
  },
  {
    id: 'the-drop', title: 'The Drop', reward: 350,
    brief: "TIA CARMEN: A package for the Marina. Pick it up at the garage, deliver it to the pier. The SBPD is sniffing — keep it smooth.",
    steps: [
      { kind: 'goto', x: 1140, y: 1560, r: 90, text: 'Pick up the package at the garage' },
      { kind: 'goto', x: 300, y: 2050, r: 90, text: 'Deliver the package to the Marina pier', wanted: 1 },
    ],
  },
  {
    id: 'beachfront-heat', title: 'Beachfront Heat', reward: 500,
    brief: "TIA CARMEN: The Coral Kings think the beach is theirs. Show them it isn't. Three of them, on the sand — bring a pistol.",
    steps: [
      { kind: 'goto', x: 280, y: 900, r: 120, text: 'Reach Beachfront' },
      { kind: 'defeat', count: 3, x: 280, y: 900, r: 260, text: 'Defeat the 3 Coral Kings on the beach' },
    ],
  },
  {
    id: 'payday-loan', title: 'Payday Loan', reward: 600,
    brief: "TIA CARMEN: Three of my runners left cash around town and forgot where. Old Town, the Suburbs, Industrial. Collect it all.",
    steps: [
      { kind: 'collect', count: 3, text: 'Collect the 3 cash drops around town',
        spots: [{ x: 1500, y: 460 }, { x: 3220, y: 320 }, { x: 3320, y: 1920 }] },
    ],
  },
  {
    id: 'smoke-on-water', title: 'Smoke on the Water', reward: 800,
    brief: "TIA CARMEN: The Kings hid a stash under the Marina pier. Take it. They will not hand it over nicely — four of them guard it.",
    steps: [
      { kind: 'goto', x: 300, y: 2150, r: 120, text: 'Reach the Marina pier' },
      { kind: 'defeat', count: 4, x: 300, y: 2150, r: 300, text: 'Defeat the 4 guards at the pier' },
      { kind: 'collect', count: 1, text: 'Grab the stash',
        spots: [{ x: 220, y: 2150 }] },
      { kind: 'goto', x: 3060, y: 460, r: 90, text: 'Bring the stash to the safehouse' },
    ],
  },
  {
    id: 'solmar-score', title: 'The Solmar Score', reward: 2500,
    brief: "TIA CARMEN: This is the one, Rico. Solmar Bay Bank. Hold the lobby while I crack the vault — then run, and don't stop till the safehouse.",
    steps: [
      { kind: 'goto', x: 1760, y: 940, r: 100, text: 'Reach Solmar Bay Bank', wanted: 2 },
      { kind: 'hold', x: 1760, y: 940, r: 150, secs: 20, text: 'Hold the bank lobby — 20 seconds', wanted: 4 },
      { kind: 'goto', x: 3060, y: 460, r: 90, text: 'Escape to the safehouse!' },
    ],
  },
];

/** Palette for the top-down city: sun-soaked, a little worn, all original. */
export const PALETTE = {
  road: '#3a3d46', roadEdge: '#2c2f38', lane: '#d8c96a',
  sidewalk: '#b9b3a4', crosswalk: '#e8e4d8',
  water: '#2e7fa8', waterDeep: '#1f5f86', sand: '#e8cf8f',
  grass: '#7fb069', pond: '#4a90c9', tree: '#3e7a34', palm: '#4a9e4a',
  buildingRoof: ['#b0563f', '#7a6a8a', '#5a7a8a', '#8a7a5a', '#6a5a4a', '#9a8a6a'],
  windowDay: '#2e3a4a', windowLit: '#ffd97a',
  player: '#e8b73a', playerDark: '#8a6d2f',
  police: '#2e4a8a', policeLight: '#e8e8e8',
  rival: '#a83a5a', ped: ['#c97a4a', '#7a9e4a', '#4a7a9e', '#9e4a7a', '#8a8a6a'],
};
