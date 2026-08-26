import type { Vec2 } from "./types.ts";
import type { WorldLayout } from "./world.ts";

export type PickupKind = "coin" | "gem" | "torch" | "speed" | "cursed";

export interface Pickup {
  id: string;
  kind: PickupKind;
  pos: Vec2;
  collected: boolean;
}

const SCORE_BY_KIND: Record<PickupKind, number> = {
  coin: 10,
  gem: 40,
  torch: 0,
  speed: 0,
  cursed: 150,
};

export const TORCH_SIGHT_BONUS = 60;
export const SPEED_BOOST_SECONDS = 6;

export const ALERT_PULSE_RADIUS = 420;

export function createPickups(layout: WorldLayout): Pickup[] {
  const pickups: Pickup[] = [];
  layout.coinPositions.forEach((pos, i) => pickups.push({ id: `coin-${i}`, kind: "coin", pos, collected: false }));
  layout.gemPositions.forEach((pos, i) => pickups.push({ id: `gem-${i}`, kind: "gem", pos, collected: false }));
  pickups.push({ id: "torch", kind: "torch", pos: layout.torchPos, collected: false });
  pickups.push({ id: "speed", kind: "speed", pos: layout.speedBoostPos, collected: false });
  pickups.push({ id: "cursed", kind: "cursed", pos: layout.cursedTreasurePos, collected: false });
  return pickups;
}

const COLLECT_RADIUS = 26;

export interface PickupEffect {
  scoreDelta: number;
  torchBonus: number;
  speedTimerSeconds: number;
  alertPulse: boolean;
}

function emptyEffect(): PickupEffect {
  return { scoreDelta: 0, torchBonus: 0, speedTimerSeconds: 0, alertPulse: false };
}

// Collects every not-yet-collected pickup within radius of the player in one
// pass, folding all of their effects into one summed result --- more than one
// landing on the same frame all apply, rather than only the first found.
export function collectNearby(pickups: Pickup[], playerPos: Vec2, radius = COLLECT_RADIUS): PickupEffect {
  const effect = emptyEffect();
  for (const pickup of pickups) {
    if (pickup.collected) continue;
    const dx = pickup.pos.x - playerPos.x;
    const dy = pickup.pos.y - playerPos.y;
    if (dx * dx + dy * dy > radius * radius) continue;

    pickup.collected = true;
    effect.scoreDelta += SCORE_BY_KIND[pickup.kind];
    if (pickup.kind === "torch") effect.torchBonus += TORCH_SIGHT_BONUS;
    if (pickup.kind === "speed") effect.speedTimerSeconds += SPEED_BOOST_SECONDS;
    if (pickup.kind === "cursed") effect.alertPulse = true;
  }
  return effect;
}
