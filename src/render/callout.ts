import type { Vec2 } from "../types.ts";

// A brief floating name-tag, not a tutorial: no "how to" text anywhere, just
// what the thing in front of you is called. It fires once per kind of danger
// (see main.ts's introduced-kind tracking) and teaches nothing beyond a
// label --- what the danger *does* is still left entirely to its own
// animation and the consequence of touching it.
export const CALLOUT_DURATION = 1.8;
const FADE_IN = 0.25;
const FADE_OUT = 0.4;
const RISE_PER_SECOND = 5;

export function drawCallout(ctx: CanvasRenderingContext2D, pos: Vec2, text: string, timer: number): void {
  const age = CALLOUT_DURATION - timer;
  const alpha = Math.min(1, age / FADE_IN, timer / FADE_OUT);
  if (alpha <= 0) return;

  ctx.save();
  ctx.translate(pos.x, pos.y - 26 - age * RISE_PER_SECOND);
  ctx.globalAlpha = alpha;
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const width = ctx.measureText(text).width;
  ctx.fillStyle = "rgba(20, 14, 8, 0.6)";
  roundedRect(ctx, -width / 2 - 7, -11, width + 14, 22, 5);
  ctx.fill();

  ctx.fillStyle = "#f2ece0";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
