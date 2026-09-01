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

// Matches enemies.ts's SKELETON_LEASH (220) + SKELETON_DETECTION_RADIUS (150)
// plus a safety margin --- kept as a local constant rather than an import
// because enemies.ts already imports obstacles.ts, which imports this module
// as a value; importing enemies.ts back from here would create a real import
// cycle (world -> enemies -> obstacles -> world), not just a type-only one.
const SKELETON_DANGER_RADIUS = 220 + 150;
const SHIP_DANGER_CLEARANCE = SKELETON_DANGER_RADIUS + 50;

// Minimum distance kept between the named points-of-interest a run places, so
// a bad roll can't stack two treasure clusters (or the X and a fragment) on
// top of each other.
const MIN_ANCHOR_SPACING = 180;
const SAMPLE_ATTEMPTS = 50;
const NEAR_ATTEMPTS = 30;

// Small hand-placed constellations around a centre, rather than one point ---
// this is what turns a reward into a "place" instead of a dot. Coin and gem
// offsets are deliberately different shapes so the two kinds don't land on
// top of each other when a POI has both. Rotated by a random angle per anchor
// so the same relative shape doesn't look identical run to run.
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

function rotate(v: Vec2, angle: number): Vec2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

// Clamped to the world bounds --- a cluster center near the map's own edge
// (a real possibility now that anchors are randomised) could otherwise place
// an offset point just outside it.
function cluster(center: Vec2, offsets: Vec2[], count: number, angle: number, worldWidth: number, worldHeight: number): Vec2[] {
  return offsets.slice(0, count).map((o) => {
    const r = rotate(o, angle);
    return {
      x: Math.max(0, Math.min(worldWidth, center.x + r.x)),
      y: Math.max(0, Math.min(worldHeight, center.y + r.y)),
    };
  });
}

function classifyZone(x: number, y: number, caveRect: Rect, beachStartY: number, jungleStartY: number): Zone {
  if (pointInRect(x, y, caveRect)) return "cave";
  if (y >= beachStartY) return "beach";
  if (y >= jungleStartY) return "jungle";
  return "ruins";
}

function distSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

// South-to-north bands (y=0 is the north/top edge; the ship sits at the
// south/bottom, matching where the player already spawns): beach, jungle,
// ruins, with a cave pocket nested inside the ruins band rather than a band
// of its own --- a deliberate detour, not something the player must cross.
// The bands, the cave rectangle, and the ship spawn stay fixed every run ---
// what varies is where everything *within* that structure lands, via rng.
export function buildWorldLayout(rng: () => number): WorldLayout {
  const w = WORLD_WIDTH;
  const h = WORLD_HEIGHT;
  const beachStartY = h * 0.78;
  const jungleStartY = h * 0.4;
  const caveRect: Rect = { x: w * 0.05, y: h * 0.05, width: w * 0.3, height: h * 0.18 };
  const shipPos = { x: w / 2, y: h - 120 };

  const zoneBounds = (zone: Zone): Rect => {
    switch (zone) {
      case "cave":
        return caveRect;
      case "beach":
        return { x: 0, y: beachStartY, width: w, height: h - beachStartY };
      case "jungle":
        return { x: 0, y: jungleStartY, width: w, height: beachStartY - jungleStartY };
      case "ruins":
        return { x: 0, y: 0, width: w, height: jungleStartY };
    }
  };

  // Rejection-sample a point that both lands in `zone` (bounding-box sampling
  // can still miss --- the cave rect carves a hole out of the ruins band's
  // coordinate range) and passes `isValid`, if given.
  const sampleInZone = (zone: Zone, isValid?: (p: Vec2) => boolean): Vec2 | null => {
    const bounds = zoneBounds(zone);
    for (let attempt = 0; attempt < SAMPLE_ATTEMPTS; attempt++) {
      const p = { x: bounds.x + rng() * bounds.width, y: bounds.y + rng() * bounds.height };
      if (classifyZone(p.x, p.y, caveRect, beachStartY, jungleStartY) !== zone) continue;
      if (isValid && !isValid(p)) continue;
      return p;
    }
    return null;
  };

  // A point near `anchor` at a random angle/distance, constrained to stay in
  // `zone` --- keeps a guard's "guards this treasure" relationship while
  // still varying its exact position every run. classifyZone only checks
  // y-bands (x is unbounded), so an offset from an anchor near the world's
  // left/right edge needs its own explicit x/y bounds check --- sampleInZone
  // doesn't need this since it always samples x from within [0, w] to begin
  // with.
  const inWorldBounds = (p: Vec2): boolean => p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h;

  const nearAnchor = (anchor: Vec2, zone: Zone, minR: number, maxR: number, isValid?: (p: Vec2) => boolean): Vec2 => {
    for (let attempt = 0; attempt < NEAR_ATTEMPTS; attempt++) {
      const angle = rng() * Math.PI * 2;
      const dist = minR + rng() * (maxR - minR);
      const p = { x: anchor.x + Math.cos(angle) * dist, y: anchor.y + Math.sin(angle) * dist };
      if (!inWorldBounds(p)) continue;
      if (classifyZone(p.x, p.y, caveRect, beachStartY, jungleStartY) !== zone) continue;
      if (isValid && !isValid(p)) continue;
      return p;
    }
    return sampleInZone(zone, isValid) ?? anchor;
  };

  const anchors: Vec2[] = [shipPos];
  const placeAnchor = (zone: Zone, isValid?: (p: Vec2) => boolean): Vec2 => {
    const spaced = (p: Vec2): boolean =>
      anchors.every((a) => distSq(p, a) >= MIN_ANCHOR_SPACING * MIN_ANCHOR_SPACING) && (!isValid || isValid(p));
    const p = sampleInZone(zone, spaced) ?? sampleInZone(zone, isValid) ?? sampleInZone(zone) ?? shipPos;
    anchors.push(p);
    return p;
  };

  // Named clusters --- the same six "places" the fixed layout used to have,
  // now placed procedurally within their zone every run.
  const spawnCove = placeAnchor("beach");
  const jungleGroveTreasure = placeAnchor("jungle");
  const jungleWestTreasure = placeAnchor("jungle");
  const ruinsVault = placeAnchor("ruins");
  const ruinsWatchtower = placeAnchor("ruins");
  const caveGrotto = placeAnchor("cave");

  // The X always sits deep in the ruins band --- the far side of the map from
  // the ship's beach spawn --- so every run is a real trek by construction,
  // whatever exact spot it lands on.
  const xPos = placeAnchor("ruins");
  const cursedTreasurePos = placeAnchor("cave");
  const torchPos = placeAnchor("ruins");
  const speedBoostPos = placeAnchor("ruins");

  // One fragment per beach/jungle/cave --- spread from the other anchors so
  // each reads as its own waypoint rather than stacked on a treasure pile.
  const fragmentPositions = [placeAnchor("beach"), placeAnchor("jungle"), placeAnchor("cave")];

  // Traps guard the same five places the fixed layout guarded --- a vault
  // (twice), a grove, the cursed grotto, and the X itself --- at a random
  // angle/distance around each so the exact spot still varies every run.
  // Drawn from the rng before the enemy density blocks below so growing
  // those blocks doesn't reshuffle where traps land for a given seed.
  const trapPositions = [
    nearAnchor(ruinsVault, "ruins", 40, 100),
    nearAnchor(ruinsVault, "ruins", 40, 100),
    nearAnchor(jungleGroveTreasure, "jungle", 40, 100),
    nearAnchor(caveGrotto, "cave", 40, 100),
    nearAnchor(xPos, "ruins", 40, 100),
  ];

  const isShipClear = (p: Vec2): boolean => distSq(p, shipPos) > SHIP_DANGER_CLEARANCE * SHIP_DANGER_CLEARANCE;

  // Seven skeleton homes, jungle-heavy with the ruins border also covered, so
  // leash+detection zones overlap each other and the ambush points below
  // rather than sitting in isolation. Every one is rejection-sampled to keep
  // its full danger radius (leash + detection) clear of the ship spawn --- a
  // skeleton that could detect the player before they'd even taken a step was
  // a real bug found in playtesting, not a hypothetical, and it has to hold
  // for every seed, not just the one fixed layout used to have. The vault gets
  // a second guard and the X itself now gets one too, so the two biggest
  // prizes on the ruins side are both properly defended, not just guarded by
  // whichever crab happens to be nearby.
  const jungleEntranceHome =
    sampleInZone("jungle", (p) => isShipClear(p) && p.y < beachStartY - 80) ?? sampleInZone("jungle", isShipClear);
  const skeletonHomes = [
    jungleEntranceHome ?? { x: w / 2, y: jungleStartY },
    nearAnchor(jungleGroveTreasure, "jungle", 140, 320, isShipClear),
    nearAnchor(jungleWestTreasure, "jungle", 140, 320, isShipClear),
    nearAnchor(ruinsVault, "ruins", 140, 320, isShipClear),
    nearAnchor(ruinsVault, "ruins", 140, 320, isShipClear),
    nearAnchor(ruinsWatchtower, "ruins", 140, 320, isShipClear),
    nearAnchor(xPos, "ruins", 140, 320, isShipClear),
  ];

  // Nine ambush points, several placed to overlap a skeleton's territory or a
  // treasure cluster rather than stand alone --- that overlap is the "danger
  // zone", not a single ambush in a quiet corner. The X itself is now guarded
  // too, and two extra free-roaming ambushes widen the overlap further.
  const crabAmbushPoints = [
    nearAnchor(jungleGroveTreasure, "jungle", 60, 160),
    nearAnchor(ruinsVault, "ruins", 60, 160),
    nearAnchor(jungleWestTreasure, "jungle", 60, 160),
    placeAnchor("jungle"),
    nearAnchor(ruinsWatchtower, "ruins", 60, 160),
    placeAnchor("ruins"),
    nearAnchor(xPos, "ruins", 60, 160),
    placeAnchor("jungle"),
    placeAnchor("ruins"),
  ];

  // Six ghosts in a cave pocket this small is dense on purpose --- two are
  // anchored directly on the cave's own guarded treasures (the cursed hoard
  // and the grotto) so those specific spots read as guarded, the rest spread
  // from each other and from the cursed treasure so the pocket still reads as
  // a patrol, not one stacked spawn.
  const GHOST_SPAWN_COUNT = 6;
  const ghostSpawnPoints: Vec2[] = [];
  for (let i = 0; i < GHOST_SPAWN_COUNT; i++) {
    const others = [cursedTreasurePos, ...ghostSpawnPoints];
    const spread = (p: Vec2): boolean => others.every((o) => distSq(p, o) >= 60 * 60);
    if (i === 0) {
      ghostSpawnPoints.push(nearAnchor(cursedTreasurePos, "cave", 40, 120));
    } else if (i === 1) {
      ghostSpawnPoints.push(nearAnchor(caveGrotto, "cave", 40, 120));
    } else {
      ghostSpawnPoints.push(sampleInZone("cave", spread) ?? sampleInZone("cave") ?? caveGrotto);
    }
  }

  const spawnCoveAngle = rng() * Math.PI * 2;
  const jungleGroveAngle = rng() * Math.PI * 2;
  const jungleWestAngle = rng() * Math.PI * 2;
  const watchtowerAngle = rng() * Math.PI * 2;
  const vaultAngle = rng() * Math.PI * 2;
  const grottoAngle = rng() * Math.PI * 2;

  return {
    shipPos,
    fragmentPositions,
    xPos,
    cursedTreasurePos,
    coinPositions: [
      ...cluster(spawnCove, COIN_OFFSETS, 2, spawnCoveAngle, w, h),
      ...cluster(jungleGroveTreasure, COIN_OFFSETS, 3, jungleGroveAngle, w, h),
      ...cluster(jungleWestTreasure, COIN_OFFSETS, 2, jungleWestAngle, w, h),
      ...cluster(ruinsWatchtower, COIN_OFFSETS, 2, watchtowerAngle, w, h),
      ...cluster(ruinsVault, COIN_OFFSETS, 2, vaultAngle, w, h),
    ],
    gemPositions: [
      ...cluster(jungleGroveTreasure, GEM_OFFSETS, 2, jungleGroveAngle, w, h),
      ...cluster(ruinsVault, GEM_OFFSETS, 2, vaultAngle, w, h),
      ...cluster(caveGrotto, GEM_OFFSETS, 2, grottoAngle, w, h),
    ],
    torchPos,
    speedBoostPos,
    trapPositions,
    skeletonHomes,
    crabAmbushPoints,
    ghostSpawnPoints,
    caveRect,
    beachStartY,
    jungleStartY,
  };
}

// Cave is checked first --- it's a rectangle nested inside the ruins y-band,
// so falling through to the band checks first would make it unreachable.
export function zoneAt(layout: WorldLayout, x: number, y: number): Zone {
  return classifyZone(x, y, layout.caveRect, layout.beachStartY, layout.jungleStartY);
}
