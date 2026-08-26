import type { CrabEnemy, Enemy, SkeletonEnemy } from "../enemies.ts";

const SKELETON_BONE = "#e8e2d0";
const SKELETON_OUTLINE = "#8a8270";
const CRAB_SHELL = "#b5502f";
const CRAB_OUTLINE = "#6e2f1a";

export function drawEnemies(ctx: CanvasRenderingContext2D, enemies: Enemy[], now: number): void {
  for (const enemy of enemies) {
    drawEnemy(ctx, enemy, now);
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, now: number): void {
  switch (enemy.kind) {
    case "skeleton":
      drawSkeleton(ctx, enemy);
      break;
    case "crab":
      drawCrab(ctx, enemy);
      break;
    case "ghost":
      // Ghosts stay undrawn outside the cave until checkpoint 8 wires the
      // zone gate --- nothing to render here yet.
      break;
  }

  if (enemy.state === "alert") {
    drawAlertTell(ctx, enemy, now);
  }
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
