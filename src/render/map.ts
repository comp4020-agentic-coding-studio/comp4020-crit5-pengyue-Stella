import { type Cell, type GameMap, SKETCH_PHASE_END, revealProgress } from "../map.ts";

const PARCHMENT = "#e8d9b5";
const INK = "#5a4a30";

const TERRAIN_COLOR: Record<Cell["terrain"], string> = {
  sand: "#e2c98f",
  tuft: "#9ea866",
  rock: "#8d8577",
  driftwood: "#8a6a44",
  treeClump: "#5f7a4a",
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
      drawCell(ctx, cell, col * cellSize, row * cellSize, cellSize, t);
    }
  }
}

function drawCell(ctx: CanvasRenderingContext2D, cell: Cell, x: number, y: number, size: number, t: number): void {
  if (t <= SKETCH_PHASE_END) {
    ctx.save();
    ctx.globalAlpha = t / SKETCH_PHASE_END;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    drawTerrainGlyph(ctx, cell, x, y, size, false);
    ctx.restore();
    return;
  }

  const washAlpha = (t - SKETCH_PHASE_END) / (1 - SKETCH_PHASE_END);
  ctx.save();
  ctx.globalAlpha = washAlpha;
  ctx.fillStyle = TERRAIN_COLOR[cell.terrain];
  ctx.fillRect(x, y, size, size);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  drawTerrainGlyph(ctx, cell, x, y, size, true);
  ctx.restore();
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
    default:
      ctx.beginPath();
      ctx.arc(cx + wobble * 0.4, cy + wobble * 0.4, 0.8, 0, Math.PI * 2);
      ctx.stroke();
  }
}
