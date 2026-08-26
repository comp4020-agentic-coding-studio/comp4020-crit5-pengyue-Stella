import type { Size } from "./types.ts";

// Zones (beach/jungle/ruins/cave) are a later checkpoint; for now every cell
// carries one of these scattered doodles so the sketch-then-wash reveal has
// something worth drawing.
export type Terrain = "sand" | "tuft" | "rock" | "driftwood" | "treeClump";

export interface Cell {
  terrain: Terrain;
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

export function createMap(cols: number, rows: number, cellSize: number): GameMap {
  const cells: Cell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({
        terrain: pickTerrain(),
        revealStart: null,
        revealed: false,
        seed: Math.random(),
      });
    }
  }
  return { cols, rows, cellSize, cells };
}

function pickTerrain(): Terrain {
  const roll = Math.random();
  if (roll < 0.55) return "sand";
  if (roll < 0.7) return "tuft";
  if (roll < 0.82) return "rock";
  if (roll < 0.92) return "driftwood";
  return "treeClump";
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
