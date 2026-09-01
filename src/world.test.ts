import { describe, expect, it } from "vitest";
import { SKELETON_DETECTION_RADIUS, SKELETON_LEASH } from "./enemies.ts";
import { mulberry32 } from "./rng.ts";
import { buildWorldLayout, WORLD_HEIGHT, WORLD_WIDTH, zoneAt } from "./world.ts";

describe("buildWorldLayout", () => {
  it("keeps every skeleton home's full danger radius clear of the ship spawn, across many seeds", () => {
    const dangerRadius = SKELETON_LEASH + SKELETON_DETECTION_RADIUS;

    for (let seed = 0; seed < 20; seed++) {
      const layout = buildWorldLayout(mulberry32(seed * 104729 + 3));
      for (const home of layout.skeletonHomes) {
        const dist = Math.hypot(home.x - layout.shipPos.x, home.y - layout.shipPos.y);
        expect(dist).toBeGreaterThan(dangerRadius);
      }
    }
  });

  it("resolves the cave rectangle before falling back to the beach/jungle/ruins y-bands", () => {
    const layout = buildWorldLayout(mulberry32(1));
    const { caveRect } = layout;
    const center = { x: caveRect.x + caveRect.width / 2, y: caveRect.y + caveRect.height / 2 };

    expect(zoneAt(layout, center.x, center.y)).toBe("cave");
  });

  it("places every point of interest inside the world bounds, across many seeds", () => {
    for (let seed = 0; seed < 20; seed++) {
      const layout = buildWorldLayout(mulberry32(seed * 2654435761 + 7));
      const points = [
        layout.shipPos,
        layout.xPos,
        layout.cursedTreasurePos,
        layout.torchPos,
        layout.speedBoostPos,
        ...layout.fragmentPositions,
        ...layout.coinPositions,
        ...layout.gemPositions,
        ...layout.trapPositions,
        ...layout.skeletonHomes,
        ...layout.crabAmbushPoints,
        ...layout.ghostSpawnPoints,
      ];

      for (const p of points) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(WORLD_WIDTH);
        expect(p.y).toBeLessThanOrEqual(WORLD_HEIGHT);
      }
    }
  });

  it("produces a meaningfully different layout for a different seed", () => {
    const a = buildWorldLayout(mulberry32(1));
    const b = buildWorldLayout(mulberry32(2));

    expect(a.xPos).not.toEqual(b.xPos);
    expect(a.skeletonHomes).not.toEqual(b.skeletonHomes);
  });
});
