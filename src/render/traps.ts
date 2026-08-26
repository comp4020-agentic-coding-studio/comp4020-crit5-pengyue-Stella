import { cellAt, type GameMap, revealProgress } from "../map.ts";
import {
  TRAP_ANTICIPATION_DURATION,
  TRAP_COOLDOWN_DURATION,
  TRAP_TRIGGER_DURATION,
  type Trap,
} from "../traps.ts";

const SPIKE_COUNT = 7;
const BASE_RADIUS = 20;

// Cheap deterministic hash for shape/jitter variety --- stable per (seed, i)
// so a trap's silhouette doesn't reshape itself from frame to frame.
function pseudoRandom(seed: number, i: number): number {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// How far the spikes are extended, 0 (flush with the ground) .. 1 (fully
// sprung) --- always at least a little raised even at rest, so a dormant trap
// still reads as "spikes poking out of a pit", never an abstract flat mark.
function extensionFor(trap: Trap): number {
  switch (trap.state) {
    case "dormant":
      return 0.35;
    case "anticipating":
      return 0.35 + 0.65 * Math.min(1, trap.stateTimer / TRAP_ANTICIPATION_DURATION);
    case "triggered":
      return 1;
    case "cooldown":
      return 1 - 0.65 * Math.min(1, trap.stateTimer / TRAP_COOLDOWN_DURATION);
  }
}

function drawTrap(ctx: CanvasRenderingContext2D, trap: Trap, now: number): void {
  const { x, y } = trap.pos;
  const extension = extensionFor(trap);
  const jitter = trap.state === "anticipating" ? Math.sin(now / 40 + trap.seed * 10) * 1.5 * extension : 0;

  ctx.save();
  ctx.translate(x + jitter, y);

  ctx.fillStyle = "#2c1810";
  ctx.strokeStyle = "#140b07";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, 4, BASE_RADIUS, BASE_RADIUS * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Warning ring brightens toward red as the spikes rise --- the single
  // clearest "this is dangerous" read at a glance, independent of state.
  ctx.strokeStyle = `rgba(196, 60, 40, ${0.35 + 0.5 * extension})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 4, BASE_RADIUS * 1.15, BASE_RADIUS * 0.62, 0, 0, Math.PI * 2);
  ctx.stroke();

  const spikeColor = extension > 0.7 ? "#d9463a" : "#5a5048";
  for (let i = 0; i < SPIKE_COUNT; i++) {
    const angle = (i / SPIKE_COUNT) * Math.PI * 2;
    const wobble = 0.8 + 0.3 * pseudoRandom(trap.seed, i);
    const spikeR = BASE_RADIUS * 0.72 * wobble;
    const baseX = Math.cos(angle) * spikeR;
    const baseY = Math.sin(angle) * spikeR * 0.55 + 4;
    const tipLen = 6 + extension * 14 * wobble;
    const tipX = Math.cos(angle) * (spikeR + tipLen * 0.3);
    const tipY = baseY - tipLen;

    ctx.fillStyle = spikeColor;
    ctx.strokeStyle = "#1a0f0a";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(baseX - 2.4, baseY);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(baseX + 2.4, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  if (trap.state === "triggered") {
    const burst = Math.min(1, trap.stateTimer / TRAP_TRIGGER_DURATION);
    ctx.strokeStyle = `rgba(242, 201, 76, ${0.8 * (1 - burst)})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r1 = BASE_RADIUS * 0.9;
      const r2 = BASE_RADIUS * (1.3 + burst * 0.9);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * r1, Math.sin(angle) * r1 * 0.55 + 4);
      ctx.lineTo(Math.cos(angle) * r2, Math.sin(angle) * r2 * 0.55 + 4);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// Same fog-of-war gating as obstacles/terrain --- a trap must stay hidden
// until its cell has been revealed, or it gives away a guarded POI's exact
// location before the player has actually found the place.
export function drawTraps(ctx: CanvasRenderingContext2D, traps: Trap[], map: GameMap, now: number): void {
  for (const trap of traps) {
    const col = Math.floor(trap.pos.x / map.cellSize);
    const row = Math.floor(trap.pos.y / map.cellSize);
    const cell = cellAt(map, col, row);
    if (!cell) continue;
    const t = revealProgress(cell, now);
    if (t <= 0) continue;

    ctx.save();
    ctx.globalAlpha = t;
    drawTrap(ctx, trap, now);
    ctx.restore();
  }
}
