import { describe, expect, it } from "vitest";
import { createObstacles, isBlocked, isReachableWorld } from "./obstacles.ts";
import { mulberry32 } from "./rng.ts";
import { buildWorldLayout } from "./world.ts";

describe("obstacle placement", () => {
  // A single clearance-radius-based placement can still seal off a point of
  // interest by chance --- that's what worldgen.ts's retry loop is for. This
  // mirrors that same retry contract (same attempt cap, same seed-derivation)
  // rather than asserting the stronger, false claim that one un-retried
  // attempt is always reachable.
  it("never seals off a fragment, the X, or the cursed treasure from the ship, across many seeds", () => {
    for (let seed = 0; seed < 20; seed++) {
      let reachable = false;
      for (let attempt = 0; attempt < 12 && !reachable; attempt++) {
        const rng = mulberry32(seed * 7919 + 1 + attempt * 104729);
        const layout = buildWorldLayout(rng);
        const obstacles = createObstacles(layout, rng);
        reachable = isReachableWorld(layout, obstacles);
      }
      expect(reachable).toBe(true);
    }
  });

  it("never places an obstacle overlapping the ship's own spawn point", () => {
    const rng = mulberry32(20260826);
    const layout = buildWorldLayout(rng);
    const obstacles = createObstacles(layout, rng);
    expect(isBlocked(layout.shipPos, 10, obstacles)).toBe(false);
  });
});
