import { cellAt, type Cell, type GameMap, SKETCH_PHASE_END, revealProgress } from "../map.ts";
import type { Vec2 } from "../types.ts";
import type { Zone } from "../world.ts";
import { drawIcon } from "./pickups.ts";

const PARCHMENT = "#e8d9b5";

const TERRAIN_COLOR: Record<Cell["terrain"], string> = {
  sand: "#e2c98f",
  tuft: "#9ea866",
  rock: "#8d8577",
  driftwood: "#8a6a44",
  treeClump: "#5f7a4a",
  bones: "#d8cfb8",
  mound: "#c9a86b",
  rubble: "#75706a",
  mist: "#b4c8dc",
};

const INK_FOR_ZONE: Record<Zone, string> = {
  beach: "#5a4a30",
  jungle: "#3f4a26",
  ruins: "#4a4438",
  cave: "#9fb4c9",
};

// Draws blank parchment everywhere, then each visible cell that has started
// (or finished) revealing --- a pen-stroke sketch first, a colour wash after.
export function drawMap(
  ctx: CanvasRenderingContext2D,
  map: GameMap,
  now: number,
  viewLeft: number,
  viewTop: number,
  viewWidth: number,
  viewHeight: number,
): void {
  const { cellSize } = map;
  ctx.fillStyle = PARCHMENT;
  ctx.fillRect(viewLeft, viewTop, viewWidth, viewHeight);

  const minCol = Math.max(0, Math.floor(viewLeft / cellSize));
  const maxCol = Math.min(map.cols - 1, Math.floor((viewLeft + viewWidth) / cellSize));
  const minRow = Math.max(0, Math.floor(viewTop / cellSize));
  const maxRow = Math.min(map.rows - 1, Math.floor((viewTop + viewHeight) / cellSize));

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const cell = map.cells[row * map.cols + col];
      if (!cell) continue;
      const t = revealProgress(cell, now);
      if (t <= 0) continue;
      drawCell(ctx, map, cell, col, row, col * cellSize, row * cellSize, cellSize, t);
    }
  }
}

const X_POP_DURATION = 500;

// Tied to map/progression state (when the X was revealed), not an entity
// list --- that's why it lives here rather than in render/pickups.ts, even
// though it draws through that module's shared icon helper. Eases past 1
// then settles, so the reveal reads as a definite "pop" rather than a fade.
export function drawXMarker(ctx: CanvasRenderingContext2D, pos: Vec2, now: number, revealedAt: number): void {
  const elapsed = Math.max(0, now - revealedAt);
  const t = Math.min(1, elapsed / X_POP_DURATION);
  const scale = t >= 1 ? 1 : overshootEase(t);

  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.scale(scale, scale);
  ctx.translate(-pos.x, -pos.y);
  drawIcon(ctx, "x", pos.x, pos.y, now);
  ctx.restore();
}

function overshootEase(t: number): number {
  const c = 1.7;
  const tm1 = t - 1;
  return 1 + (c + 1) * tm1 ** 3 + c * tm1 ** 2;
}

// Cave cells are shaded toward black on top of their terrain colour, so the
// cave reads as near-dark even though it reuses the same terrain palette.
function shadeForZone(hex: string, zone: Zone): string {
  if (zone !== "cave") return hex;
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.round(((value >> 16) & 0xff) * 0.32);
  const g = Math.round(((value >> 8) & 0xff) * 0.32);
  const b = Math.round((value & 0xff) * 0.32);
  return `rgb(${r}, ${g}, ${b})`;
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  map: GameMap,
  cell: Cell,
  col: number,
  row: number,
  x: number,
  y: number,
  size: number,
  t: number,
): void {
  const ink = INK_FOR_ZONE[cell.zone];

  if (t <= SKETCH_PHASE_END) {
    ctx.save();
    ctx.globalAlpha = t / SKETCH_PHASE_END;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.2;
    drawTerrainGlyph(ctx, cell, x, y, size, false);
    ctx.restore();
    return;
  }

  // Blending each cell's colour with its neighbours', and painting an
  // oversized irregular blob instead of an axis-aligned rect, is what turns
  // a grid of flat-coloured tiles into something reading as continuous
  // painted terrain --- the two together, not either alone.
  const washAlpha = (t - SKETCH_PHASE_END) / (1 - SKETCH_PHASE_END);
  const blended = blendedTerrainColor(map, col, row);
  ctx.save();
  ctx.globalAlpha = washAlpha;
  ctx.fillStyle = shadeForZone(blended, cell.zone);
  drawTerrainBlob(ctx, x + size / 2, y + size / 2, size, cell.seed);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.2;
  drawTerrainGlyph(ctx, cell, x, y, size, true);
  ctx.restore();
}

const NEIGHBOR_OFFSETS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function rgbToHex(r: number, g: number, b: number): string {
  const channel = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

// Own cell outweighs any single neighbour, so terrain kinds stay
// recognisable up close while the boundary between patches still softens.
function blendedTerrainColor(map: GameMap, col: number, row: number): string {
  const own = cellAt(map, col, row);
  if (!own) return PARCHMENT;
  const [ownR, ownG, ownB] = hexToRgb(TERRAIN_COLOR[own.terrain]);
  let r = ownR * 3;
  let g = ownG * 3;
  let b = ownB * 3;
  let weight = 3;
  for (const [dc, dr] of NEIGHBOR_OFFSETS) {
    const neighbor = cellAt(map, col + dc, row + dr);
    if (!neighbor) continue;
    const [nr, ng, nb] = hexToRgb(TERRAIN_COLOR[neighbor.terrain]);
    r += nr;
    g += ng;
    b += nb;
    weight += 1;
  }
  return rgbToHex(r / weight, g / weight, b / weight);
}

// Cheap deterministic hash for shape wobble --- stable per (seed, i) so a
// cell's blob doesn't reshape itself from frame to frame.
function pseudoRandom(seed: number, i: number): number {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Deliberately oversized relative to the cell --- neighbouring blobs overlap
// a little, which is what removes the hard seams a fillRect grid always has.
function drawTerrainBlob(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, seed: number): void {
  const points = 7;
  const baseRadius = size * 0.64;
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const wobble = 0.82 + 0.3 * pseudoRandom(seed, i);
    const radius = baseRadius * wobble;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawTerrainGlyph(
  ctx: CanvasRenderingContext2D,
  cell: Cell,
  x: number,
  y: number,
  size: number,
  filled: boolean,
): void {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const wobble = (cell.seed - 0.5) * size * 0.3;

  switch (cell.terrain) {
    case "tuft":
      ctx.beginPath();
      ctx.moveTo(cx - 4 + wobble, cy + 4);
      ctx.lineTo(cx - 2 + wobble, cy - 5);
      ctx.moveTo(cx + wobble, cy + 4);
      ctx.lineTo(cx + 1 + wobble, cy - 6);
      ctx.moveTo(cx + 4 + wobble, cy + 4);
      ctx.lineTo(cx + 3 + wobble, cy - 5);
      ctx.stroke();
      return;
    case "rock": {
      const r = size * 0.22;
      ctx.beginPath();
      ctx.ellipse(cx + wobble, cy, r * 1.3, r, 0, 0, Math.PI * 2);
      if (filled) {
        ctx.fillStyle = "#6b6558";
        ctx.fill();
      }
      ctx.stroke();
      return;
    }
    case "driftwood":
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + wobble * 0.3);
      ctx.lineTo(cx + 8, cy - wobble * 0.3);
      ctx.stroke();
      return;
    case "treeClump": {
      const r = size * 0.28;
      ctx.beginPath();
      ctx.arc(cx + wobble * 0.5, cy - 2, r, 0, Math.PI * 2);
      if (filled) {
        ctx.fillStyle = "#3f5a34";
        ctx.fill();
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + wobble * 0.5, cy - 2);
      ctx.lineTo(cx + wobble * 0.5, cy + size * 0.3);
      ctx.stroke();
      return;
    }
    case "bones": {
      const r = size * 0.18;
      ctx.beginPath();
      ctx.moveTo(cx - r + wobble, cy - r * 0.4);
      ctx.lineTo(cx + r + wobble, cy + r * 0.4);
      ctx.moveTo(cx - r + wobble, cy + r * 0.4);
      ctx.lineTo(cx + r + wobble, cy - r * 0.4);
      ctx.stroke();
      if (filled) {
        ctx.beginPath();
        ctx.arc(cx + wobble, cy, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = "#f2ece0";
        ctx.fill();
      }
      return;
    }
    case "mound": {
      const r = size * 0.24;
      ctx.beginPath();
      ctx.ellipse(cx + wobble, cy + 2, r, r * 0.55, 0, 0, Math.PI * 2);
      if (filled) {
        ctx.fillStyle = "#c9a86b";
        ctx.fill();
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.6 + wobble, cy - r * 0.6);
      ctx.lineTo(cx - r * 0.3 + wobble, cy - r * 1.1);
      ctx.moveTo(cx + wobble, cy - r * 0.6);
      ctx.lineTo(cx + wobble * 1.2, cy - r * 1.2);
      ctx.stroke();
      return;
    }
    case "rubble":
      ctx.beginPath();
      ctx.moveTo(cx - 7 + wobble, cy + 5);
      ctx.lineTo(cx - 2 + wobble, cy - 6);
      ctx.lineTo(cx + 5 + wobble, cy + 2);
      ctx.closePath();
      if (filled) {
        ctx.fillStyle = "#5c5850";
        ctx.fill();
      }
      ctx.stroke();
      return;
    case "mist": {
      const r = size * 0.3;
      ctx.beginPath();
      ctx.arc(cx - r * 0.4 + wobble, cy, r * 0.6, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.4 + wobble, cy - 2, r * 0.5, 0, Math.PI * 2);
      if (filled) {
        ctx.fillStyle = "rgba(200, 214, 230, 0.45)";
        ctx.fill();
      }
      ctx.stroke();
      return;
    }
    default:
      ctx.beginPath();
      ctx.arc(cx + wobble * 0.4, cy + wobble * 0.4, 0.8, 0, Math.PI * 2);
      ctx.stroke();
  }
}
