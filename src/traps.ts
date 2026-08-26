import type { Vec2 } from "./types.ts";
import type { WorldLayout } from "./world.ts";

// A trap is a stationary hazard, not an enemy --- no chase, no home to return
// to. Its whole design is telegraph-then-strike: dormant until approached,
// then a fixed anticipation window (the "clear anticipation" the redesign
// asked for) before it's briefly lethal, then a cooldown before it re-arms.
export type TrapState = "dormant" | "anticipating" | "triggered" | "cooldown";

export interface Trap {
  id: string;
  pos: Vec2;
  state: TrapState;
  stateTimer: number;
  /** stable per-trap random value, used to vary render shape/timing */
  seed: number;
}

// Anticipation is longer than the crab's 0.4s telegraph --- a trap is a fixed
// mechanism, not a creature reacting, so it should read as mechanically
// winding up rather than startling.
export const TRAP_ARM_RADIUS = 60;
export const TRAP_HIT_RADIUS = 22;
export const TRAP_ANTICIPATION_DURATION = 0.55;
export const TRAP_TRIGGER_DURATION = 0.35;
export const TRAP_COOLDOWN_DURATION = 1.4;

export function createTraps(layout: WorldLayout): Trap[] {
  return layout.trapPositions.map((pos, i) => ({
    id: `trap-${i}`,
    pos: { ...pos },
    state: "dormant" as TrapState,
    stateTimer: 0,
    seed: i * 7.31 + 1,
  }));
}

// No re-checking once anticipation starts, matching the crab ambush's own
// "always resolves" rule --- the fairness comes from the trap being visually
// loud well before it's lethal, not from a last-second abort.
export function updateTraps(traps: Trap[], playerPos: Vec2, dt: number): void {
  for (const trap of traps) {
    trap.stateTimer += dt;
    switch (trap.state) {
      case "dormant":
        if (distance(trap.pos, playerPos) <= TRAP_ARM_RADIUS) {
          trap.state = "anticipating";
          trap.stateTimer = 0;
        }
        break;
      case "anticipating":
        if (trap.stateTimer >= TRAP_ANTICIPATION_DURATION) {
          trap.state = "triggered";
          trap.stateTimer = 0;
        }
        break;
      case "triggered":
        if (trap.stateTimer >= TRAP_TRIGGER_DURATION) {
          trap.state = "cooldown";
          trap.stateTimer = 0;
        }
        break;
      case "cooldown":
        if (trap.stateTimer >= TRAP_COOLDOWN_DURATION) {
          trap.state = "dormant";
          trap.stateTimer = 0;
        }
        break;
    }
  }
}

// Only the frames a trap is mid-strike count as a hazard the player can
// actually touch --- feed these straight into checkLoss's `enemies` circle
// list from the call site (a hit is a hit, regardless of what caused it).
export function trapHitCircles(traps: Trap[]): { pos: Vec2; radius: number }[] {
  return traps.filter((t) => t.state === "triggered").map((t) => ({ pos: t.pos, radius: TRAP_HIT_RADIUS }));
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
