import { ATTACK_HALF_ANGLE, ATTACK_RANGE, ATTACK_SWING_DURATION } from "../combat.ts";
import type { Vec2 } from "../types.ts";

// Drawn in world space, on top of the pirate --- a faint wedge for the hit
// zone plus a bright blade that sweeps across it, so a swing reads instantly
// even without a dedicated arm-swing pose on the character itself.
export function drawSwordSwing(ctx: CanvasRenderingContext2D, pos: Vec2, facing: 1 | -1, swingTimer: number): void {
  if (swingTimer <= 0) return;
  const progress = 1 - swingTimer / ATTACK_SWING_DURATION;
  const facingAngle = facing === 1 ? 0 : Math.PI;
  const sweep = (progress * 2 - 1) * ATTACK_HALF_ANGLE * 0.8;
  const bladeAngle = facingAngle + sweep;
  const fade = 1 - progress;

  ctx.save();
  ctx.translate(pos.x, pos.y - 6);

  ctx.globalAlpha = 0.2 * fade;
  ctx.fillStyle = "#f2efe2";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, ATTACK_RANGE, facingAngle - ATTACK_HALF_ANGLE, facingAngle + ATTACK_HALF_ANGLE);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = fade;
  ctx.strokeStyle = "#e9e6d8";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(Math.cos(bladeAngle) * 12, Math.sin(bladeAngle) * 12);
  ctx.lineTo(Math.cos(bladeAngle) * ATTACK_RANGE * 0.9, Math.sin(bladeAngle) * ATTACK_RANGE * 0.9);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.lineWidth = 1.1;
  ctx.stroke();

  ctx.restore();
}
