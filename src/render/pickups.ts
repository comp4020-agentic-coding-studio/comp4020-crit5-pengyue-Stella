import type { Fragment } from "../fragments.ts";
import type { Pickup } from "../pickups.ts";

const RADIUS = 9;

// Shared icon set: pickups here, plus fragments and the X marker elsewhere,
// all draw through this one function parameterised by shape/colour rather
// than each getting their own tiny render module.
export type IconKind = Pickup["kind"] | "fragment" | "x";

export function drawPickups(ctx: CanvasRenderingContext2D, pickups: Pickup[], now: number): void {
  for (const pickup of pickups) {
    if (pickup.collected) continue;
    drawIcon(ctx, pickup.kind, pickup.pos.x, pickup.pos.y, now);
  }
}

export function drawFragments(ctx: CanvasRenderingContext2D, fragments: Fragment[], now: number): void {
  for (const fragment of fragments) {
    if (fragment.collected) continue;
    drawIcon(ctx, "fragment", fragment.pos.x, fragment.pos.y, now);
  }
}

function bobOffset(now: number, seed: number): number {
  return Math.sin(now / 420 + seed) * 3;
}

export function drawIcon(ctx: CanvasRenderingContext2D, kind: IconKind, x: number, y: number, now: number): void {
  const y0 = y + bobOffset(now, x * 0.013 + y * 0.017);
  ctx.save();
  ctx.translate(x, y0);

  switch (kind) {
    case "coin":
      ctx.fillStyle = "#e8c14a";
      ctx.strokeStyle = "#a9862a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    case "gem":
      ctx.fillStyle = "#4fb6c9";
      ctx.strokeStyle = "#1f6d7a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -RADIUS);
      ctx.lineTo(RADIUS * 0.8, 0);
      ctx.lineTo(0, RADIUS);
      ctx.lineTo(-RADIUS * 0.8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case "torch":
      ctx.fillStyle = "#8a6a44";
      ctx.fillRect(-2, -2, 4, 12);
      ctx.fillStyle = "#e8823a";
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.quadraticCurveTo(6, -8, 0, -2);
      ctx.quadraticCurveTo(-6, -8, 0, -16);
      ctx.fill();
      break;
    case "speed":
      ctx.strokeStyle = "#2c5a3c";
      ctx.fillStyle = "#3f8f5f";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-6, 8);
      ctx.lineTo(1, 8);
      ctx.lineTo(-3, 0);
      ctx.lineTo(4, 0);
      ctx.lineTo(-4, -9);
      ctx.lineTo(-2, -1);
      ctx.lineTo(-8, -1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case "cursed":
      ctx.fillStyle = "#5a2733";
      ctx.strokeStyle = "#1a0a0e";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, -2, RADIUS * 0.8, Math.PI, 0);
      ctx.lineTo(RADIUS * 0.8, 4);
      ctx.lineTo(-RADIUS * 0.8, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#1a0a0e";
      ctx.beginPath();
      ctx.arc(-3, -2, 1.6, 0, Math.PI * 2);
      ctx.arc(3, -2, 1.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "fragment":
      ctx.fillStyle = "#c9a86b";
      ctx.strokeStyle = "#5a4a30";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-8, -5);
      ctx.lineTo(7, -7);
      ctx.lineTo(8, 6);
      ctx.lineTo(-6, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case "x":
      ctx.strokeStyle = "#b3241f";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-9, -9);
      ctx.lineTo(9, 9);
      ctx.moveTo(9, -9);
      ctx.lineTo(-9, 9);
      ctx.stroke();
      break;
  }

  ctx.restore();
}
