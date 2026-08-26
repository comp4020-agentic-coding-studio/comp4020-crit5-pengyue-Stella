import type { Vec2 } from "./types.ts";

// Fixed once, reused everywhere: enemy homes decided here are the same
// coordinates enemies spawn at, and the same coordinates the map's terrain
// decorations (bone density, ambush mounds) cluster around --- deciding it in
// one place avoids the two drifting apart.
export type Zone = "beach" | "jungle" | "ruins" | "cave";

export const WORLD_COLS = 80;
export const WORLD_ROWS = 60;
export const WORLD_CELL_SIZE = 32;
export const WORLD_WIDTH = WORLD_COLS * WORLD_CELL_SIZE;
export const WORLD_HEIGHT = WORLD_ROWS * WORLD_CELL_SIZE;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorldLayout {
  shipPos: Vec2;
  fragmentPositions: Vec2[];
  xPos: Vec2;
  cursedTreasurePos: Vec2;
  coinPositions: Vec2[];
  gemPositions: Vec2[];
  torchPos: Vec2;
  speedBoostPos: Vec2;
  trapPositions: Vec2[];
  skeletonHomes: Vec2[];
  crabAmbushPoints: Vec2[];
  ghostSpawnPoints: Vec2[];
  caveRect: Rect;
  beachStartY: number;
  jungleStartY: number;
}

function pointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

// Small hand-placed constellations around a centre, rather than one point ---
// this is what turns a reward into a "place" instead of a dot. Coin and gem
// offsets are deliberately different shapes so the two kinds don't land on
// top of each other when a POI has both.
const COIN_OFFSETS: Vec2[] = [
  { x: -34, y: -18 },
  { x: 30, y: -26 },
  { x: 8, y: 30 },
  { x: -22, y: 26 },
  { x: 36, y: 14 },
];
const GEM_OFFSETS: Vec2[] = [
  { x: 46, y: -6 },
  { x: -12, y: -40 },
  { x: -44, y: 8 },
];

function cluster(center: Vec2, offsets: Vec2[], count: number): Vec2[] {
  return offsets.slice(0, count).map((o) => ({ x: center.x + o.x, y: center.y + o.y }));
}

// South-to-north bands (y=0 is the north/top edge; the ship sits at the
// south/bottom, matching where the player already spawns): beach, jungle,
// ruins, with a cave pocket nested inside the ruins band rather than a band
// of its own --- a deliberate detour, not something the player must cross.
export function buildWorldLayout(): WorldLayout {
  const w = WORLD_WIDTH;
  const h = WORLD_HEIGHT;
  const beachStartY = h * 0.78;
  const jungleStartY = h * 0.4;
  const caveRect: Rect = { x: w * 0.05, y: h * 0.05, width: w * 0.3, height: h * 0.18 };

  const shipPos = { x: w / 2, y: h - 120 };
  const xPos = { x: w * 0.42, y: h * 0.22 };
  const cursedTreasurePos = { x: caveRect.x + caveRect.width * 0.3, y: caveRect.y + caveRect.height * 0.7 };

  // Points of interest --- a handful of named places instead of an even
  // scatter, each either a light early foothold or guarded by a nearby
  // enemy home/ambush point and/or a trap (declared further down).
  const spawnCove = { x: w / 2 + 140, y: h - 220 };
  const jungleGroveTreasure = { x: 1800, y: 1120 };
  const jungleWestTreasure = { x: 600, y: 1080 };
  const ruinsVault = { x: 1300, y: 320 };
  const ruinsWatchtower = { x: 950, y: 260 };
  const caveGrotto = { x: 380, y: 300 };

  return {
    shipPos,
    fragmentPositions: [
      { x: w / 2 - 260, y: h - 260 },
      { x: w * 0.62, y: h * 0.55 },
      { x: caveRect.x + caveRect.width * 0.6, y: caveRect.y + caveRect.height * 0.5 },
    ],
    xPos,
    cursedTreasurePos,
    coinPositions: [
      ...cluster(spawnCove, COIN_OFFSETS, 2),
      ...cluster(jungleGroveTreasure, COIN_OFFSETS, 3),
      ...cluster(jungleWestTreasure, COIN_OFFSETS, 2),
      ...cluster(ruinsWatchtower, COIN_OFFSETS, 2),
      ...cluster(ruinsVault, COIN_OFFSETS, 2),
    ],
    gemPositions: [
      ...cluster(jungleGroveTreasure, GEM_OFFSETS, 2),
      ...cluster(ruinsVault, GEM_OFFSETS, 2),
      ...cluster(caveGrotto, GEM_OFFSETS, 2),
    ],
    torchPos: { x: 1360, y: 340 },
    speedBoostPos: { x: 1250, y: 420 },
    // Guarding a vault, a grove, the cursed grotto and the X itself --- traps
    // sit right where a treasure cluster's own guard enemies leave a gap.
    trapPositions: [
      { x: ruinsVault.x - 70, y: ruinsVault.y + 50 },
      { x: ruinsVault.x + 60, y: ruinsVault.y - 40 },
      { x: jungleGroveTreasure.x - 50, y: jungleGroveTreasure.y + 40 },
      { x: caveGrotto.x + 55, y: caveGrotto.y - 35 },
      { x: xPos.x + 45, y: xPos.y + 55 },
    ],
    // Five homes instead of two --- jungle-heavy with one deliberately pushed
    // into the ruins border, so leash+detection zones overlap each other and
    // the ambush points below rather than sitting in isolation. The first
    // entry guards the jungle entrance the player walks through from the
    // ship, but sits deep enough in that its leash+detection radius (370px)
    // can't reach the ship spawn itself --- a skeleton that could detect the
    // player before they'd even taken a step was a real bug found in
        // playtesting, not a hypothetical.
    skeletonHomes: [
      { x: w / 2, y: beachStartY - 240 },
      { x: 1740.8, y: 1056 },
      { x: 563.2, y: 1113.6 },
      { x: w / 2, y: jungleStartY - 40 },
      { x: 970, y: 300 },
    ],
    // Six ambush points, several placed to overlap a skeleton's territory
    // rather than stand alone --- that overlap is the "danger zone", not a
    // single ambush in a quiet corner.
    crabAmbushPoints: [
      { x: 896, y: 614.4 },
      { x: 1408, y: 288 },
      { x: 384, y: 672 },
      { x: 640, y: 1152 },
      { x: 1203.2, y: 345.6 },
      { x: 1920, y: 1190.4 },
    ],
    // Four ghosts in a cave pocket this small is already dense --- doubled
    // from two so the detour actually feels dangerous, not merely spooky.
    ghostSpawnPoints: [
      { x: caveRect.x + caveRect.width * 0.3, y: caveRect.y + caveRect.height * 0.3 },
      { x: caveRect.x + caveRect.width * 0.7, y: caveRect.y + caveRect.height * 0.7 },
      { x: caveRect.x + caveRect.width * 0.5, y: caveRect.y + caveRect.height * 0.85 },
      { x: caveRect.x + caveRect.width * 0.15, y: caveRect.y + caveRect.height * 0.6 },
    ],
    caveRect,
    beachStartY,
    jungleStartY,
  };
}

// Cave is checked first --- it's a rectangle nested inside the ruins y-band,
// so falling through to the band checks first would make it unreachable.
export function zoneAt(layout: WorldLayout, x: number, y: number): Zone {
  if (pointInRect(x, y, layout.caveRect)) return "cave";
  if (y >= layout.beachStartY) return "beach";
  if (y >= layout.jungleStartY) return "jungle";
  return "ruins";
}
