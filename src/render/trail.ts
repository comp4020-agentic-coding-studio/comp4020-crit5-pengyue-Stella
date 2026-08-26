import type { Trail } from "../trail.ts";

export interface TrailRenderOptions {
  /** escape-climax mode: brighter, thicker, pulsing --- a lifeline back to the ship */
  lifeline: boolean;
  now: number;
}

// Bows each segment slightly off the straight line using each point's fixed
// jitter, so the stroke reads as hand-drawn rather than a ruler-straight
// debug line --- and stays stable frame to frame instead of shimmering.
export function drawTrail(ctx: CanvasRenderingContext2D, trail: Trail, opts?: TrailRenderOptions): void {
  if (trail.points.length < 2) return;
  const lifeline = opts?.lifeline ?? false;
  const now = opts?.now ?? 0;
  const pulse = lifeline ? 0.75 + 0.25 * Math.sin(now / 180) : 1;

  ctx.save();
  ctx.strokeStyle = lifeline ? "#ffd23f" : "#b3241f";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = lifeline ? "rgba(255, 210, 63, 0.6)" : "rgba(120, 20, 15, 0.35)";
  ctx.shadowBlur = lifeline ? 6 : 2;

  for (let i = 1; i < trail.points.length; i++) {
    const a = trail.points[i - 1];
    const b = trail.points[i];
    if (!a || !b) continue;

    const nx = -(b.y - a.y);
    const ny = b.x - a.x;
    const len = Math.hypot(nx, ny) || 1;
    const offset = (a.jitter + b.jitter) / 2;
    const midX = (a.x + b.x) / 2 + (nx / len) * offset;
    const midY = (a.y + b.y) / 2 + (ny / len) * offset;

    ctx.lineWidth = (lifeline ? 4 : 2.5) * ((a.widthJitter + b.widthJitter) / 2) * pulse;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(midX, midY, b.x, b.y);
    ctx.stroke();
  }

  ctx.restore();
}
