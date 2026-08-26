import type { Joystick } from "../input.ts";

const RADIUS = 44;
const THUMB_RADIUS = 18;

// Drawn in screen space (clientX/clientY, no camera translate) --- only
// visible while a touch/pointer drag is active.
export function drawJoystick(ctx: CanvasRenderingContext2D, joystick: Joystick): void {
  if (!joystick.active) return;

  const dx = joystick.current.x - joystick.anchor.x;
  const dy = joystick.current.y - joystick.anchor.y;
  const dist = Math.min(Math.hypot(dx, dy), RADIUS);
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = "#3a2a1a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(joystick.anchor.x, joystick.anchor.y, RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "#3a2a1a";
  ctx.beginPath();
  ctx.arc(joystick.anchor.x + Math.cos(angle) * dist, joystick.anchor.y + Math.sin(angle) * dist, THUMB_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
