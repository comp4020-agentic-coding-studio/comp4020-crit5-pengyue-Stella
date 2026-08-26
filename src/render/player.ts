import type { Vec2 } from "../types.ts";

export interface PlayerVisualState {
  pos: Vec2;
  facing: 1 | -1;
  moving: boolean;
  /** seconds, accumulates every frame; drives the bob/swing phase */
  animTime: number;
  /** bandana offset, lerped toward a target each frame so it lags behind the body */
  hatLag: Vec2;
}

const IDLE_FREQ = 1.6;
const RUN_FREQ = 8;

// A small vector chibi pirate: oversized head, small body, no image assets.
// The bob/squash/arm-swing amplitude is what makes idle vs. running readable
// with zero text.
export function drawPirate(ctx: CanvasRenderingContext2D, state: PlayerVisualState): void {
  const { pos, facing, moving, animTime, hatLag } = state;
  const freq = moving ? RUN_FREQ : IDLE_FREQ;
  const phase = animTime * freq;
  const bob = Math.sin(phase) * (moving ? 4 : 1.5);
  const squash = 1 + Math.sin(phase) * (moving ? 0.08 : 0.02);

  ctx.save();
  ctx.translate(pos.x, pos.y + bob);
  ctx.scale(facing * squash, 1 / squash);

  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(0, 17, 11, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const legSwing = moving ? Math.sin(phase) * 4 : 0;
  ctx.fillStyle = "#5b3d22";
  ctx.fillRect(-6 + legSwing * 0.3, 6, 4, 8);
  ctx.fillRect(2 - legSwing * 0.3, 6, 4, 8);

  ctx.fillStyle = "#7a2e2e";
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  const armSwing = moving ? Math.sin(phase + Math.PI) * 5 : Math.sin(animTime * IDLE_FREQ) * 1;
  ctx.strokeStyle = "#7a2e2e";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-8, -2);
  ctx.lineTo(-11, 6 + armSwing);
  ctx.moveTo(8, -2);
  ctx.lineTo(11, 6 - armSwing);
  ctx.stroke();

  ctx.fillStyle = "#e8b98a";
  ctx.beginPath();
  ctx.arc(0, -14, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(-5, -17, 6, 3);
  ctx.beginPath();
  ctx.arc(3, -15, 1.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(hatLag.x, hatLag.y - 1);
  if (!moving) ctx.rotate(Math.sin(animTime * IDLE_FREQ) * 0.05);
  ctx.fillStyle = "#b3241f";
  ctx.beginPath();
  ctx.moveTo(-10, -20);
  ctx.quadraticCurveTo(0, -27, 10, -20);
  ctx.quadraticCurveTo(0, -22, -10, -20);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(9, -19);
  ctx.quadraticCurveTo(16, -15, 13, -9);
  ctx.quadraticCurveTo(11, -15, 8, -17);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}
