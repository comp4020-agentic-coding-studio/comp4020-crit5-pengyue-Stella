import { CRAB_TELEGRAPH_DURATION, DEATH_FADE_DURATION, HIT_FLASH_DURATION } from "../enemies.ts";
import type { CrabEnemy, Enemy, GhostEnemy, SkeletonEnemy } from "../enemies.ts";

const HIT_FLASH_RADIUS = 15;

const SKELETON_BONE = "#e8e2d0";
const SKELETON_OUTLINE = "#8a8270";
const CRAB_SHELL = "#b5502f";
const CRAB_OUTLINE = "#6e2f1a";
const GHOST_FILL = "rgba(214, 227, 236, 0.55)";
const GHOST_OUTLINE = "rgba(150, 170, 185, 0.6)";

export function drawEnemies(
  ctx: CanvasRenderingContext2D,
  enemies: Enemy[],
  now: number,
  playerInCave: boolean,
): void {
  for (const enemy of enemies) {
    drawEnemy(ctx, enemy, now, playerInCave);
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, now: number, playerInCave: boolean): void {
  const defeated = enemy.state === "defeated";
  const dead = enemy.state === "dead";
  if (defeated || dead) {
    // Tip the whole sprite over around its own position --- a sword hit needs
    // to read as "down", not just "still standing there". A permanent kill
    // additionally shrinks and fades all the way out over DEATH_FADE_DURATION
    // so it reads as gone for good, distinct from the temporary stun.
    const fade = dead ? Math.max(0, 1 - enemy.stateTimer / DEATH_FADE_DURATION) : 1;
    ctx.save();
    ctx.translate(enemy.pos.x, enemy.pos.y);
    ctx.rotate((enemy.facing * Math.PI) / 2.1);
    ctx.scale(fade, fade);
    ctx.translate(-enemy.pos.x, -enemy.pos.y);
    ctx.globalAlpha = dead ? fade * 0.85 : 0.55;
  }

  switch (enemy.kind) {
    case "skeleton":
      drawSkeleton(ctx, enemy);
      break;
    case "crab":
      drawCrab(ctx, enemy);
      if (enemy.state === "alert") drawCrabRipple(ctx, enemy);
      break;
    case "ghost":
      // Invisible outside the cave --- it doesn't spawn or act there either.
      if (playerInCave) drawGhost(ctx, enemy, now);
      break;
  }

  if (defeated || dead) ctx.restore();

  if (enemy.hitFlash > 0) drawHitFlash(ctx, enemy);

  if (enemy.state === "alert") {
    drawAlertTell(ctx, enemy, now);
  }
}

// A brief white flash right where the sword connected --- strong, immediate
// feedback that a hit landed, decaying over HIT_FLASH_DURATION regardless of
// what state the enemy transitions into afterward.
function drawHitFlash(ctx: CanvasRenderingContext2D, enemy: Enemy): void {
  const alpha = Math.min(1, enemy.hitFlash / HIT_FLASH_DURATION);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha * 0.85;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(enemy.pos.x, enemy.pos.y, HIT_FLASH_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSkeleton(ctx: CanvasRenderingContext2D, enemy: SkeletonEnemy): void {
  ctx.save();
  ctx.translate(enemy.pos.x, enemy.pos.y);
  ctx.scale(enemy.facing, 1);

  ctx.fillStyle = SKELETON_BONE;
  ctx.strokeStyle = SKELETON_OUTLINE;
  ctx.lineWidth = 1.2;

  ctx.beginPath();
  ctx.rect(-6, -4, 12, 14);
  ctx.fill();
  ctx.stroke();

  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-6, i * 4);
    ctx.lineTo(6, i * 4);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(0, -10, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#2a2a2a";
  ctx.beginPath();
  ctx.arc(-2, -10, 1.3, 0, Math.PI * 2);
  ctx.arc(2, -10, 1.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = SKELETON_BONE;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-3, 10);
  ctx.lineTo(-4, 17);
  ctx.moveTo(3, 10);
  ctx.lineTo(4, 17);
  ctx.stroke();

  ctx.restore();
}

function drawCrab(ctx: CanvasRenderingContext2D, enemy: CrabEnemy): void {
  ctx.save();
  ctx.translate(enemy.pos.x, enemy.pos.y);
  ctx.scale(enemy.facing, 1);

  ctx.fillStyle = CRAB_SHELL;
  ctx.strokeStyle = CRAB_OUTLINE;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, 2, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-9, -1);
  ctx.lineTo(-13, -6);
  ctx.moveTo(9, -1);
  ctx.lineTo(13, -6);
  ctx.stroke();

  ctx.restore();
}

function drawGhost(ctx: CanvasRenderingContext2D, enemy: GhostEnemy, now: number): void {
  const drift = Math.sin(now / 260 + enemy.pos.x) * 3;
  ctx.save();
  ctx.translate(enemy.pos.x, enemy.pos.y + drift);
  ctx.scale(enemy.facing, 1);

  ctx.fillStyle = GHOST_FILL;
  ctx.strokeStyle = GHOST_OUTLINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, -4, 9, Math.PI, 0);
  ctx.lineTo(9, 10);
  for (let i = 0; i < 3; i++) {
    const x = 9 - i * 6;
    ctx.quadraticCurveTo(x - 3, 6, x - 6, 10);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(30, 40, 50, 0.6)";
  ctx.beginPath();
  ctx.arc(-3, -5, 1.2, 0, Math.PI * 2);
  ctx.arc(3, -5, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// A ripple in the sand, separate from the shared alert-tell --- only drawn
// during the crab's own pre-burst telegraph window.
function drawCrabRipple(ctx: CanvasRenderingContext2D, enemy: CrabEnemy): void {
  const progress = Math.min(1, enemy.burstTimer / CRAB_TELEGRAPH_DURATION);
  const radius = 8 + progress * 14;
  ctx.save();
  ctx.translate(enemy.pos.x, enemy.pos.y + 6);
  ctx.strokeStyle = `rgba(214, 190, 140, ${0.6 * (1 - progress)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius, radius * 0.4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Type-agnostic --- keyed only on FSM state, not enemy kind, so it works for
// crab/ghost unchanged once checkpoint 8 puts them into "alert" too.
function drawAlertTell(ctx: CanvasRenderingContext2D, enemy: Enemy, now: number): void {
  const bob = Math.sin(now / 90) * 2;
  ctx.save();
  ctx.translate(enemy.pos.x, enemy.pos.y - 24 + bob);
  ctx.font = "bold 16px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f2c94c";
  ctx.strokeStyle = "#7a5c12";
  ctx.lineWidth = 1;
  ctx.strokeText("!", 0, 0);
  ctx.fillText("!", 0, 0);
  ctx.restore();
}
