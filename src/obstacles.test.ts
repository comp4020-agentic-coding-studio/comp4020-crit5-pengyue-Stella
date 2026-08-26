import { describe, expect, it } from "vitest";
import type { Obstacle } from "./obstacles.ts";
import { createObstacles, isBlocked } from "./obstacles.ts";
import { buildWorldLayout, WORLD_HEIGHT, WORLD_WIDTH } from "./world.ts";

// Coarse-grid flood fill from the ship --- the safety net against obstacle
// clusters accidentally sealing off a fragment, the X, or the cursed
// treasure. Grid (not the real player radius) because we only care about
// "is there some route", not the exact clearance a body needs.
const GRID_STEP = 24;
const PROBE_RADIUS = 12;

function reachableFrom(start: { x: number; y: number }, obstacles: Obstacle[]): Set<string> {
  const cols = Math.floor(WORLD_WIDTH / GRID_STEP);
  const rows = Math.floor(WORLD_HEIGHT / GRID_STEP);
  const key = (col: number, row: number): string => `${col},${row}`;

  const startCol = Math.round(start.x / GRID_STEP);
  const startRow = Math.round(start.y / GRID_STEP);

  const visited = new Set<string>([key(startCol, startRow)]);
  const queue: Array<[number, number]> = [[startCol, startRow]];

  while (queue.length > 0) {
    const [col, row] = queue.shift() as [number, number];
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const nk = key(nc, nr);
      if (visited.has(nk)) continue;
      const pos = { x: nc * GRID_STEP, y: nr * GRID_STEP };
      if (isBlocked(pos, PROBE_RADIUS, obstacles)) continue;
      visited.add(nk);
      queue.push([nc, nr]);
    }
  }
  return visited;
}

describe("obstacle placement", () => {
  it("never seals off a fragment, the X, or the cursed treasure from the ship", () => {
    const layout = buildWorldLayout();
    const obstacles = createObstacles(layout);
    const visited = reachableFrom(layout.shipPos, obstacles);

    const targets = [layout.xPos, layout.cursedTreasurePos, ...layout.fragmentPositions];
    for (const target of targets) {
      const col = Math.round(target.x / GRID_STEP);
      const row = Math.round(target.y / GRID_STEP);
      expect(visited.has(`${col},${row}`)).toBe(true);
    }
  });

  it("never places an obstacle overlapping the ship's own spawn point", () => {
    const layout = buildWorldLayout();
    const obstacles = createObstacles(layout);
    expect(isBlocked(layout.shipPos, 10, obstacles)).toBe(false);
  });
});
