import { ATTACK_BUTTON_RADIUS, attackButtonCenter } from "../input.ts";
import { ATTACK_COOLDOWN } from "../combat.ts";

// Drawn in screen space, always on --- unlike the joystick (which only shows
// mid-drag), this is a persistent tap target so it has to be visible before
// it's ever touched. A sword glyph reads the mechanic without any caption.
export function drawAttackButton(
  ctx: CanvasRenderingContext2D,
  viewportWidth: number,
  viewportHeight: number,
  cooldown: number,
): void {
  const center = attackButtonCenter(viewportWidth, viewportHeight);
  const ready = cooldown <= 0;

  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = "#241a12";
  ctx.beginPath();
  ctx.arc(center.x, center.y, ATTACK_BUTTON_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  if (!ready) {
    const progress = 1 - cooldown / ATTACK_COOLDOWN;
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = "#f2efe2";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center.x, center.y, ATTACK_BUTTON_RADIUS - 2, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = ready ? 0.85 : 0.4;
  ctx.translate(center.x, center.y);
  ctx.rotate(-Math.PI / 4);
  ctx.strokeStyle = "#e9e6d8";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(0, 10);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-6, 6);
  ctx.lineTo(6, 6);
  ctx.stroke();
  ctx.fillStyle = "#b3241f";
  ctx.beginPath();
  ctx.arc(0, 12, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
