import type { Vec2 } from "./types.ts";
import type { Zone } from "./world.ts";

export type ProgressStatus = "explore" | "xRevealed" | "escaping" | "won" | "lost";

export interface Circle {
  pos: Vec2;
  radius: number;
}

export function circlesOverlap(a: Circle, b: Circle): boolean {
  const dx = a.pos.x - b.pos.x;
  const dy = a.pos.y - b.pos.y;
  const r = a.radius + b.radius;
  return dx * dx + dy * dy <= r * r;
}

export interface LossCheckState {
  status: ProgressStatus;
  player: Circle;
  enemies: Circle[];
}

// Any one enemy touching the player ends the run, checked across every active
// state (explore/xRevealed/escaping). Already-terminal states are left alone
// --- a win can't be retroactively turned into a loss, and a loss doesn't need
// re-checking.
export function checkLoss(state: LossCheckState): ProgressStatus {
  if (state.status === "won" || state.status === "lost") return state.status;
  const hit = state.enemies.some((enemy) => circlesOverlap(state.player, enemy));
  return hit ? "lost" : state.status;
}

const FRAGMENTS_NEEDED = 3;

export interface FragmentState {
  status: ProgressStatus;
  fragmentsCollected: number;
}

// Only the third fragment flips progression --- the first two just add to the
// count.
export function collectFragment(status: ProgressStatus, fragmentsCollected: number): FragmentState {
  const next = fragmentsCollected + 1;
  if (status === "explore" && next >= FRAGMENTS_NEEDED) {
    return { status: "xRevealed", fragmentsCollected: next };
  }
  return { status, fragmentsCollected: next };
}

// Reaching the X only matters once it's revealed and all three fragments are
// in hand --- this is also where the final treasure is granted, per the
// progression diagram (there's no separate treasure-pickup point).
export function reachX(status: ProgressStatus, fragmentsCollected: number): ProgressStatus {
  if (status === "xRevealed" && fragmentsCollected >= FRAGMENTS_NEEDED) return "escaping";
  return status;
}

export function reachShip(status: ProgressStatus): ProgressStatus {
  return status === "escaping" ? "won" : status;
}

const CAVE_SIGHT_SHRINK = 0.55;

// Torch bonus is added first, then the cave's hard shrink applies on top ---
// so a torch collected before entering the cave is a real, testable
// advantage rather than being cancelled out by the shrink.
export function computeSightRadius(baseSightRadius: number, torchBonus: number, zone: Zone): number {
  const withTorch = baseSightRadius + torchBonus;
  return zone === "cave" ? withTorch * CAVE_SIGHT_SHRINK : withTorch;
}
