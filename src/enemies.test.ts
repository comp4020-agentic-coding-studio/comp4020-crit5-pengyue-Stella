import { describe, expect, it } from "vitest";
import { createEnemies, triggerAlertPulse } from "./enemies.ts";
import type { WorldLayout } from "./world.ts";

function makeLayout(): WorldLayout {
  return {
    shipPos: { x: 0, y: 0 },
    fragmentPositions: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ],
    xPos: { x: 0, y: 0 },
    cursedTreasurePos: { x: 500, y: 500 },
    coinPositions: [],
    gemPositions: [],
    torchPos: { x: 0, y: 0 },
    speedBoostPos: { x: 0, y: 0 },
    skeletonHomes: [{ x: 550, y: 500 }],
    crabAmbushPoints: [{ x: 900, y: 500 }],
    ghostSpawnPoints: [{ x: 500, y: 900 }],
    caveRect: { x: 0, y: 0, width: 100, height: 100 },
    beachStartY: 1500,
    jungleStartY: 800,
  };
}

describe("triggerAlertPulse", () => {
  it("forces every enemy within radius into chase, leaves farther ones untouched", () => {
    const layout = makeLayout();
    const enemies = createEnemies(layout);
    const origin = layout.cursedTreasurePos;

    triggerAlertPulse(enemies, origin, 100);

    const skeleton = enemies.find((e) => e.kind === "skeleton");
    const crab = enemies.find((e) => e.kind === "crab");
    const ghost = enemies.find((e) => e.kind === "ghost");

    expect(skeleton?.state).toBe("chase");
    expect(crab?.state).toBe("patrol");
    expect(ghost?.state).toBe("patrol");
  });

  it("resets stateTimer on every enemy it pulls into chase", () => {
    const layout = makeLayout();
    const enemies = createEnemies(layout);
    for (const enemy of enemies) enemy.stateTimer = 9;

    triggerAlertPulse(enemies, layout.cursedTreasurePos, 1000);

    for (const enemy of enemies) {
      expect(enemy.state).toBe("chase");
      expect(enemy.stateTimer).toBe(0);
    }
  });
});
