import type { Size } from "./types.ts";
import { type WorldLayout, type Zone, zoneAt } from "./world.ts";

export type Terrain =
  | "sand"
  | "tuft"
  | "rock"
  | "driftwood"
  | "treeClump"
  | "bones"
  | "mound"
  | "rubble"
  | "mist";

export interface Cell {
  terrain: Terrain;
  zone: Zone;
  /** performance.now() timestamp the reveal animation started, or null while hidden */
  revealStart: number | null;
  /** true once the reveal animation has finished --- cells never re-hide */
  revealed: boolean;
  /** stable per-cell random value, used to vary how a terrain glyph is drawn */
  seed: number;
}

export interface GameMap {
  cols: number;
  rows: number;
  cellSize: number;
  cells: Cell[];
}

export const REVEAL_DURATION_MS = 650;
// The sketch phase (pen-stroke outline) covers the first slice of the
// animation; the rest is the colour wash filling in underneath it.
export const SKETCH_PHASE_END = 0.4;

const BONE_RADIUS = 160;
const MOUND_RADIUS = 120;

// Roughly this many cells wide per terrain patch --- a coherent noise field
// carves a zone into a few contiguous groves/reefs/rubble-fields instead of
// scattering independent per-cell rolls into a checkerboard.
const NOISE_SCALE = 4.5;

export function createMap(cols: number, rows: number, cellSize: number, layout: WorldLayout): GameMap {
  const cells: Cell[] = [];
  const noiseSeed = Math.random() * 1000;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = col * cellSize + cellSize / 2;
      const cy = row * cellSize + cellSize / 2;
      const zone = zoneAt(layout, cx, cy);
      const nearSkeletonHome = layout.skeletonHomes.some((p) => withinRadius(p.x, p.y, cx, cy, BONE_RADIUS));
      const nearCrabAmbush = layout.crabAmbushPoints.some((p) => withinRadius(p.x, p.y, cx, cy, MOUND_RADIUS));
      const density = valueNoise(col / NOISE_SCALE, row / NOISE_SCALE, noiseSeed);
      cells.push({
        terrain: pickTerrain(zone, density, nearSkeletonHome, nearCrabAmbush),
        zone,
        revealStart: null,
        revealed: false,
        seed: Math.random(),
      });
    }
  }
  return { cols, rows, cellSize, cells };
}

function withinRadius(ax: number, ay: number, bx: number, by: number, radius: number): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy <= radius * radius;
}

// Deterministic 2D value noise (bilinear-interpolated hashed lattice) ---
// spatially coherent terrain needs neighbouring cells to land on similar
// values, which independent per-cell Math.random() rolls can never give.
function hashLattice(ix: number, iy: number, seed: number): number {
  let h = ix * 374761393 + iy * 668265263 + seed * 2246822519;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const sx = smoothstep(x - x0);
  const sy = smoothstep(y - y0);
  const n00 = hashLattice(x0, y0, seed);
  const n10 = hashLattice(x0 + 1, y0, seed);
  const n01 = hashLattice(x0, y0 + 1, seed);
  const n11 = hashLattice(x0 + 1, y0 + 1, seed);
  const top = n00 + (n10 - n00) * sx;
  const bottom = n01 + (n11 - n01) * sx;
  return top + (bottom - top) * sy;
}

// `density` is spatially smooth, so these thresholds carve the same noise
// field into contiguous patches per zone instead of scattering independent
// single-cell rolls --- that's what turns "grid of tile types" into "a few
// big terrain patches" (groves, reefs, rubble fields).
function pickTerrain(zone: Zone, density: number, nearSkeletonHome: boolean, nearCrabAmbush: boolean): Terrain {
  if (nearSkeletonHome && density < 0.35) return "bones";
  if (nearCrabAmbush && density < 0.3) return "mound";

  switch (zone) {
    case "beach":
      if (density < 0.6) return "sand";
      if (density < 0.78) return "driftwood";
      if (density < 0.92) return "tuft";
      return "rock";
    case "jungle":
      if (density < 0.5) return "treeClump";
      if (density < 0.75) return "tuft";
      if (density < 0.9) return "sand";
      return "rock";
    case "ruins":
      if (density < 0.5) return "rubble";
      if (density < 0.75) return "rock";
      if (density < 0.9) return "sand";
      return "tuft";
    case "cave":
      if (density < 0.55) return "mist";
      if (density < 0.8) return "rock";
      return "rubble";
  }
}

export function worldSize(map: GameMap): Size {
  return { width: map.cols * map.cellSize, height: map.rows * map.cellSize };
}

export function cellAt(map: GameMap, col: number, row: number): Cell | undefined {
  if (col < 0 || row < 0 || col >= map.cols || row >= map.rows) return undefined;
  return map.cells[row * map.cols + col];
}

// Starts the reveal animation for any still-hidden cell within `radiusPx` of
// the given world position. Cells already revealing or revealed are untouched
// --- this is a one-way draw, not a fog mask that could cover something back up.
export function revealAround(map: GameMap, worldX: number, worldY: number, radiusPx: number, now: number): void {
  const { cellSize } = map;
  const minCol = Math.max(0, Math.floor((worldX - radiusPx) / cellSize));
  const maxCol = Math.min(map.cols - 1, Math.floor((worldX + radiusPx) / cellSize));
  const minRow = Math.max(0, Math.floor((worldY - radiusPx) / cellSize));
  const maxRow = Math.min(map.rows - 1, Math.floor((worldY + radiusPx) / cellSize));
  const radiusSq = radiusPx * radiusPx;

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const cell = cellAt(map, col, row);
      if (!cell || cell.revealStart !== null) continue;
      const cx = col * cellSize + cellSize / 2;
      const cy = row * cellSize + cellSize / 2;
      const dx = cx - worldX;
      const dy = cy - worldY;
      if (dx * dx + dy * dy <= radiusSq) {
        cell.revealStart = now;
      }
    }
  }
}

// Flips a cell to fully `revealed` once its animation has run to completion.
export function advanceReveal(map: GameMap, now: number): void {
  for (const cell of map.cells) {
    if (cell.revealStart !== null && !cell.revealed && now - cell.revealStart >= REVEAL_DURATION_MS) {
      cell.revealed = true;
    }
  }
}

// 0 (hidden) .. 1 (fully drawn in), for the render side's sketch-then-wash animation.
export function revealProgress(cell: Cell, now: number): number {
  if (cell.revealed) return 1;
  if (cell.revealStart === null) return 0;
  return Math.min(1, (now - cell.revealStart) / REVEAL_DURATION_MS);
}
