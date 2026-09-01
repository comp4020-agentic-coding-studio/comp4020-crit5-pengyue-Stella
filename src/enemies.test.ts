import { describe, expect, it } from "vitest";
import { applySwordHit, createEnemies, isEnemyVulnerable, pruneDeadEnemies, triggerAlertPulse } from "./enemies.ts";
import type { Enemy } from "./enemies.ts";
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
    trapPositions: [],
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

  it("does not resurrect an already-downed enemy into chase", () => {
    const layout = makeLayout();
    const enemies = createEnemies(layout);
    const skeleton = enemies.find((e) => e.kind === "skeleton")!;
    skeleton.state = "dead";
    skeleton.stateTimer = 0;

    triggerAlertPulse(enemies, layout.cursedTreasurePos, 1000);

    expect(skeleton.state).toBe("dead");
  });
});

describe("applySwordHit", () => {
  function findKind(enemies: Enemy[], kind: Enemy["kind"]): Enemy {
    const found = enemies.find((e) => e.kind === kind);
    if (!found) throw new Error(`no ${kind} in fixture`);
    return found;
  }

  it("takes a skeleton two hits to kill", () => {
    const enemies = createEnemies(makeLayout());
    const skeleton = findKind(enemies, "skeleton");

    expect(applySwordHit(skeleton, { x: 0, y: 0 }, 200)).toBe(true);
    expect(skeleton.state).toBe("defeated");
    expect(skeleton.hp).toBe(1);

    skeleton.state = "patrol"; // simulate it having recovered
    expect(applySwordHit(skeleton, { x: 0, y: 0 }, 200)).toBe(true);
    expect(skeleton.state).toBe("dead");
    expect(skeleton.hp).toBe(0);
  });

  it("kills a still-buried (patrol) crab in one sneak-attack hit", () => {
    const enemies = createEnemies(makeLayout());
    const crab = findKind(enemies, "crab");
    expect(crab.state).toBe("patrol");

    applySwordHit(crab, { x: 0, y: 0 }, 200);

    expect(crab.state).toBe("dead");
    expect(crab.hp).toBe(0);
  });

  it("takes a surfaced (non-patrol) crab two hits to kill", () => {
    const enemies = createEnemies(makeLayout());
    const crab = findKind(enemies, "crab");
    crab.state = "chase";

    applySwordHit(crab, { x: 0, y: 0 }, 200);
    expect(crab.state).toBe("defeated");
    expect(crab.hp).toBe(1);

    crab.state = "chase"; // simulate it having recovered and re-noticed
    applySwordHit(crab, { x: 0, y: 0 }, 200);
    expect(crab.state).toBe("dead");
    expect(crab.hp).toBe(0);
  });

  it("is a no-op against an already-defeated or dead enemy", () => {
    const enemies = createEnemies(makeLayout());
    const skeleton = findKind(enemies, "skeleton");
    skeleton.state = "defeated";
    const hpBefore = skeleton.hp;

    expect(applySwordHit(skeleton, { x: 0, y: 0 }, 200)).toBe(false);
    expect(skeleton.hp).toBe(hpBefore);

    skeleton.state = "dead";
    expect(applySwordHit(skeleton, { x: 0, y: 0 }, 200)).toBe(false);
  });

  it("sets a hit flash on a landed hit", () => {
    const enemies = createEnemies(makeLayout());
    const skeleton = findKind(enemies, "skeleton");

    applySwordHit(skeleton, { x: 0, y: 0 }, 200);

    expect(skeleton.hitFlash).toBeGreaterThan(0);
  });
});

describe("isEnemyVulnerable", () => {
  it("gates a ghost behind both being in the cave and holding the torch", () => {
    const ghost = findGhost();

    expect(isEnemyVulnerable(ghost, { playerInCave: false, hasTorch: false })).toBe(false);
    expect(isEnemyVulnerable(ghost, { playerInCave: true, hasTorch: false })).toBe(false);
    expect(isEnemyVulnerable(ghost, { playerInCave: false, hasTorch: true })).toBe(false);
    expect(isEnemyVulnerable(ghost, { playerInCave: true, hasTorch: true })).toBe(true);
  });

  it("never gates a skeleton or crab on cave/torch", () => {
    const enemies = createEnemies(makeLayout());
    const skeleton = enemies.find((e) => e.kind === "skeleton")!;
    const crab = enemies.find((e) => e.kind === "crab")!;

    expect(isEnemyVulnerable(skeleton, { playerInCave: false, hasTorch: false })).toBe(true);
    expect(isEnemyVulnerable(crab, { playerInCave: false, hasTorch: false })).toBe(true);
  });

  function findGhost(): Enemy {
    return createEnemies(makeLayout()).find((e) => e.kind === "ghost")!;
  }
});

describe("pruneDeadEnemies", () => {
  it("keeps a dead enemy until its fade finishes, then removes it", () => {
    const enemies = createEnemies(makeLayout());
    const skeleton = enemies.find((e) => e.kind === "skeleton")!;
    skeleton.state = "dead";
    skeleton.stateTimer = 0.1;

    expect(pruneDeadEnemies(enemies)).toHaveLength(enemies.length);

    skeleton.stateTimer = 999;
    expect(pruneDeadEnemies(enemies)).toHaveLength(enemies.length - 1);
  });

  it("leaves non-dead enemies untouched", () => {
    const enemies = createEnemies(makeLayout());
    expect(pruneDeadEnemies(enemies)).toHaveLength(enemies.length);
  });
});
