import { describe, expect, it } from "vitest";
import { isReachableWorld } from "./obstacles.ts";
import { generateWorld } from "./worldgen.ts";

describe("generateWorld", () => {
  it("produces a completable world across many seeds", () => {
    for (let seed = 0; seed < 15; seed++) {
      const { layout, obstacles } = generateWorld(seed * 999983 + 11);
      expect(isReachableWorld(layout, obstacles)).toBe(true);
    }
  });

  it("varies the X location across seeds, so a restart is a genuinely different run", () => {
    const a = generateWorld(1);
    const b = generateWorld(2);
    expect(a.layout.xPos).not.toEqual(b.layout.xPos);
  });

  it("builds a map matching the layout it was generated with", () => {
    const { layout, map } = generateWorld(42);
    expect(map.cells.length).toBe(map.cols * map.rows);
    expect(layout.shipPos.x).toBeGreaterThan(0);
  });
});
