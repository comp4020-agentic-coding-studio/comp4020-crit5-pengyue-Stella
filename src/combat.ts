import type { Vec2 } from "./types.ts";

// Short reach relative to the notice radii in main.ts (220/260) --- this is a
// close-quarters slash, not a ranged option.
export const ATTACK_RANGE = 56;
// Wider than a typical melee cone because facing is only ever left/right ---
// there's no vertical facing anywhere in the game, so a chaser approaching
// from directly ahead (up) or below on a purely-vertical walk would
// otherwise be permanently unhittable. A first real playtest died exactly
// this way; 100 degrees still leaves a real blind spot behind the player.
export const ATTACK_HALF_ANGLE = (100 * Math.PI) / 180;
export const ATTACK_COOLDOWN = 0.5;
export const ATTACK_SWING_DURATION = 0.18;
export const ATTACK_KNOCKBACK_SPEED = 260;

export interface CombatState {
  /** seconds until another swing can start; 0 means ready */
  cooldown: number;
  /** seconds remaining on the current swing's visual sweep; 0 when idle */
  swingTimer: number;
}

export function createCombatState(): CombatState {
  return { cooldown: 0, swingTimer: 0 };
}

// Advances both timers and starts a new swing if one was requested and the
// cooldown has cleared. The hit-test itself lives in the caller (it needs the
// enemy list); this only decides *whether* a swing starts this frame.
export function tryAttack(state: CombatState, requested: boolean, dt: number): boolean {
  state.cooldown = Math.max(0, state.cooldown - dt);
  state.swingTimer = Math.max(0, state.swingTimer - dt);
  if (!requested || state.cooldown > 0) return false;
  state.cooldown = ATTACK_COOLDOWN;
  state.swingTimer = ATTACK_SWING_DURATION;
  return true;
}

// A cone in front of the player along its (left/right-only) facing, not a
// full circle --- an enemy directly behind the player is safe, which is what
// makes facing matter and keeps a hit readable as "I swung that way".
export function isWithinAttackArc(playerPos: Vec2, facing: 1 | -1, targetPos: Vec2): boolean {
  const dx = targetPos.x - playerPos.x;
  const dy = targetPos.y - playerPos.y;
  const dist = Math.hypot(dx, dy);
  if (dist > ATTACK_RANGE || dist < 0.001) return false;

  const angle = Math.atan2(dy, dx);
  const facingAngle = facing === 1 ? 0 : Math.PI;
  let diff = Math.abs(angle - facingAngle);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  return diff <= ATTACK_HALF_ANGLE;
}
