import type { Vec2 } from "./types.ts";
import type { WorldLayout } from "./world.ts";

export interface Fragment {
  id: string;
  pos: Vec2;
  collected: boolean;
}

const COLLECT_RADIUS = 26;

export function createFragments(layout: WorldLayout): Fragment[] {
  return layout.fragmentPositions.map((pos, i) => ({ id: `fragment-${i}`, pos: { ...pos }, collected: false }));
}

// Returns how many fragments were newly collected this call --- almost always
// 0 or 1 since they're spread across zones, but a caller shouldn't assume
// that, so it folds every one found in range rather than stopping at the
// first.
export function collectFragments(fragments: Fragment[], playerPos: Vec2, radius = COLLECT_RADIUS): number {
  let collected = 0;
  for (const fragment of fragments) {
    if (fragment.collected) continue;
    const dx = fragment.pos.x - playerPos.x;
    const dy = fragment.pos.y - playerPos.y;
    if (dx * dx + dy * dy > radius * radius) continue;
    fragment.collected = true;
    collected += 1;
  }
  return collected;
}
