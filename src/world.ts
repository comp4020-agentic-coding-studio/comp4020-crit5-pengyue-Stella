import type { Vec2 } from "./types.ts";

// Fixed once, reused everywhere: enemy homes decided here are the same
// coordinates checkpoints 7-8 spawn real enemies at, and the same coordinates
// checkpoint 5's terrain decorations (bone density, ambush mounds) cluster
// around --- deciding it in one place avoids the two drifting apart.
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

  return {
    shipPos: { x: w / 2, y: h - 120 },
    fragmentPositions: [
      { x: w / 2 - 260, y: h - 260 },
      { x: w * 0.62, y: h * 0.55 },
      { x: caveRect.x + caveRect.width * 0.6, y: caveRect.y + caveRect.height * 0.5 },
    ],
    xPos: { x: w * 0.42, y: h * 0.22 },
    cursedTreasurePos: { x: caveRect.x + caveRect.width * 0.3, y: caveRect.y + caveRect.height * 0.7 },
    coinPositions: [
      { x: w / 2 + 120, y: h - 200 },
      { x: w * 0.7, y: h * 0.6 },
      { x: w * 0.3, y: h * 0.5 },
      { x: w * 0.55, y: h * 0.65 },
    ],
    gemPositions: [
      { x: w * 0.75, y: h * 0.5 },
      { x: w * 0.25, y: h * 0.62 },
    ],
    torchPos: { x: w * 0.6, y: h * 0.3 },
    speedBoostPos: { x: w * 0.3, y: h * 0.25 },
    skeletonHomes: [
      { x: w / 2, y: beachStartY - 60 },
      { x: w * 0.68, y: h * 0.5 },
    ],
    crabAmbushPoints: [
      { x: w * 0.35, y: h * 0.32 },
      { x: w * 0.55, y: h * 0.15 },
      { x: w * 0.15, y: h * 0.35 },
    ],
    ghostSpawnPoints: [
      { x: caveRect.x + caveRect.width * 0.3, y: caveRect.y + caveRect.height * 0.3 },
      { x: caveRect.x + caveRect.width * 0.7, y: caveRect.y + caveRect.height * 0.7 },
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
