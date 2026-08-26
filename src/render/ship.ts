import type { ScreenArrow } from "../camera.ts";
import type { Vec2 } from "../types.ts";

export interface ShipRenderOptions {
  /** escape-climax mode: glowing beacon instead of a plain moored hull */
  beacon: boolean;
  now: number;
}

// A small vector hull + mast + sail, moored at a fixed world position. The
// beacon flag (unused until the escape-climax checkpoint) swaps in a pulsing
// glow so the ship reads from a distance once the player is racing back to it.
export function drawShip(ctx: CanvasRenderingContext2D, pos: Vec2, opts: ShipRenderOptions): void {
  const { beacon, now } = opts;

  ctx.save();
  ctx.translate(pos.x, pos.y);

  if (beacon) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 260);
    const glowRadius = 70 + pulse * 20;
    const gradient = ctx.createRadialGradient(0, -20, 4, 0, -20, glowRadius);
    gradient.addColorStop(0, `rgba(255, 214, 120, ${0.55 + pulse * 0.25})`);
    gradient.addColorStop(1, "rgba(255, 214, 120, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, -20, glowRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#5b3d22";
  ctx.beginPath();
  ctx.moveTo(-48, 10);
  ctx.quadraticCurveTo(-52, 26, -30, 28);
  ctx.lineTo(30, 28);
  ctx.quadraticCurveTo(52, 26, 48, 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#3a2814";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = "#3a2814";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.lineTo(0, -46);
  ctx.stroke();

  ctx.fillStyle = beacon ? "#f2e2b8" : "#e8d9b5";
  ctx.beginPath();
  ctx.moveTo(0, -44);
  ctx.quadraticCurveTo(26, -30, 2, -12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#8a6a44";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

// Screen-space, drawn after ctx.restore() like the HUD --- points at the ship
// whenever camera.ts's offscreenArrow says it isn't currently on screen, so
// it "reads on screen from anywhere on the map" during the escape climax.
export function drawShipArrow(ctx: CanvasRenderingContext2D, arrow: ScreenArrow): void {
  ctx.save();
  ctx.translate(arrow.x, arrow.y);
  ctx.rotate(arrow.angle);
  ctx.fillStyle = "#f2c94c";
  ctx.strokeStyle = "#7a5c12";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-8, -8);
  ctx.lineTo(-8, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
