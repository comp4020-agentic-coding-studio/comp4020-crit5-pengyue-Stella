import { describe, expect, it } from "vitest";
import { SKELETON_DETECTION_RADIUS, SKELETON_LEASH } from "./enemies.ts";
import { buildWorldLayout, WORLD_HEIGHT, WORLD_WIDTH, zoneAt } from "./world.ts";

describe("buildWorldLayout", () => {
  it("keeps every skeleton home's full danger radius clear of the ship spawn", () => {
    const layout = buildWorldLayout();
    const dangerRadius = SKELETON_LEASH + SKELETON_DETECTION_RADIUS;

    for (const home of layout.skeletonHomes) {
      const dist = Math.hypot(home.x - layout.shipPos.x, home.y - layout.shipPos.y);
      expect(dist).toBeGreaterThan(dangerRadius);
    }
  });

  it("resolves the cave rectangle before falling back to the beach/jungle/ruins y-bands", () => {
    const layout = buildWorldLayout();
    const { caveRect } = layout;
    const center = { x: caveRect.x + caveRect.width / 2, y: caveRect.y + caveRect.height / 2 };

    expect(zoneAt(layout, center.x, center.y)).toBe("cave");
  });

  it("places every point of interest inside the world bounds", () => {
    const layout = buildWorldLayout();
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
  });
});
