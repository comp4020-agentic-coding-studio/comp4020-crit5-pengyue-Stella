import { cellAt, type GameMap, revealProgress } from "../map.ts";
import type { Obstacle } from "../obstacles.ts";

// Cheap deterministic hash for shape variety --- stable per (seed, i) so an
// obstacle's silhouette doesn't reshape itself from frame to frame.
function pseudoRandom(seed: number, i: number): number {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function blobPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  seed: number,
  points = 8,
): void {
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const wobble = 0.78 + 0.36 * pseudoRandom(seed, i);
    const r = radius * wobble;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawGroundShadow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = "#241d10";
  ctx.beginPath();
  ctx.ellipse(x, y + radius * 0.55, radius * 0.9, radius * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTree(ctx: CanvasRenderingContext2D, o: Obstacle): void {
  const { x, y } = o.pos;
  drawGroundShadow(ctx, x, y, o.radius);

  ctx.save();
  ctx.strokeStyle = "#4a3420";
  ctx.lineWidth = Math.max(2, o.radius * 0.18);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y + o.radius * 0.25);
  ctx.lineTo(x, y + o.radius * 0.85);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "#2c3f22";
  ctx.lineWidth = 1.4;
  ctx.fillStyle = "#527a42";
  blobPath(ctx, x + o.radius * 0.22, y - o.radius * 0.32, o.radius * 0.48, o.seed + 3.1, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#3f5a34";
  blobPath(ctx, x - o.radius * 0.18, y - o.radius * 0.15, o.radius * 0.72, o.seed, 8);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawRock(ctx: CanvasRenderingContext2D, o: Obstacle): void {
  const { x, y } = o.pos;
  drawGroundShadow(ctx, x, y, o.radius);

  ctx.save();
  ctx.fillStyle = "#7d7568";
  ctx.strokeStyle = "#4d473c";
  ctx.lineWidth = 1.4;
  blobPath(ctx, x, y, o.radius, o.seed, 6);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - o.radius * 0.3, y - o.radius * 0.4);
  ctx.lineTo(x + o.radius * 0.15, y - o.radius * 0.55);
  ctx.stroke();
  ctx.restore();
}

function drawRuinPillar(ctx: CanvasRenderingContext2D, o: Obstacle): void {
  const { x, y } = o.pos;
  drawGroundShadow(ctx, x, y, o.radius);

  const w = o.radius * 0.9;
  const h = o.radius * 1.9;
  ctx.save();
  ctx.fillStyle = "#8c8371";
  ctx.strokeStyle = "#5b5346";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y + h / 2);
  ctx.lineTo(x - w / 2, y - h / 2 + w * 0.25 * pseudoRandom(o.seed, 1));
  ctx.lineTo(x - w * 0.12, y - h / 2 - w * 0.3 * pseudoRandom(o.seed, 2));
  ctx.lineTo(x + w * 0.12, y - h / 2 + w * 0.18 * pseudoRandom(o.seed, 3));
  ctx.lineTo(x + w / 2, y - h / 2 + w * 0.32 * pseudoRandom(o.seed, 4));
  ctx.lineTo(x + w / 2, y + h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - w * 0.1, y - h * 0.18);
  ctx.lineTo(x + w * 0.08, y + h * 0.12);
  ctx.stroke();
  ctx.restore();
}

function drawWater(ctx: CanvasRenderingContext2D, o: Obstacle): void {
  const { x, y } = o.pos;
  // Multiplies against whatever fade-in alpha the caller already has active
  // (the fog-of-war reveal), rather than overwriting it outright.
  const ambient = ctx.globalAlpha;
  ctx.save();
  ctx.globalAlpha = ambient * 0.85;
  ctx.fillStyle = "#4a7a8a";
  ctx.strokeStyle = "#2f5866";
  ctx.lineWidth = 1.4;
  blobPath(ctx, x, y, o.radius, o.seed, 9);
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha = ambient * 0.4;
  ctx.strokeStyle = "#cfe8ee";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.ellipse(x, y, o.radius * (0.35 + i * 0.22), o.radius * (0.18 + i * 0.1), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWreckage(ctx: CanvasRenderingContext2D, o: Obstacle): void {
  const { x, y } = o.pos;
  drawGroundShadow(ctx, x, y, o.radius);

  ctx.save();
  ctx.fillStyle = "#7a5636";
  ctx.strokeStyle = "#4a3320";
  ctx.lineWidth = 1.2;
  const angle1 = pseudoRandom(o.seed, 5) * 0.9 - 0.5;
  const angle2 = angle1 + Math.PI / 2.4;
  for (const angle of [angle1, angle2]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.rect(-o.radius * 0.9, -o.radius * 0.16, o.radius * 1.8, o.radius * 0.32);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// Obstacles must stay behind the same fog-of-war as terrain --- otherwise
// every tree/rock/ruin on the map is visible from the very first frame
// (dimmed by the sight vignette, but still legible), which gives away the
// whole layout and defeats both the darkness system and the point of
// clustering treasure behind terrain to be discovered.
export function drawObstacles(ctx: CanvasRenderingContext2D, obstacles: Obstacle[], map: GameMap, now: number): void {
  for (const obstacle of obstacles) {
    const col = Math.floor(obstacle.pos.x / map.cellSize);
    const row = Math.floor(obstacle.pos.y / map.cellSize);
    const cell = cellAt(map, col, row);
    if (!cell) continue;
    const t = revealProgress(cell, now);
    if (t <= 0) continue;

    ctx.save();
    ctx.globalAlpha = t;
    switch (obstacle.kind) {
      case "tree":
        drawTree(ctx, obstacle);
        break;
      case "rock":
        drawRock(ctx, obstacle);
        break;
      case "ruinPillar":
        drawRuinPillar(ctx, obstacle);
        break;
      case "water":
        drawWater(ctx, obstacle);
        break;
      case "wreckage":
        drawWreckage(ctx, obstacle);
        break;
      default:
        assertNever(obstacle.kind);
    }
    ctx.restore();
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled obstacle kind: ${JSON.stringify(value)}`);
}
