import { describe, expect, it } from "vitest";
import { checkLoss, circlesOverlap, collectFragment, reachShip, reachX } from "./game-logic.ts";
import type { ProgressStatus } from "./game-logic.ts";

const ACTIVE_STATUSES: ProgressStatus[] = ["explore", "xRevealed", "escaping"];

describe("checkLoss", () => {
  const player = { pos: { x: 0, y: 0 }, radius: 10 };

  it.each(ACTIVE_STATUSES)("ends the run when any enemy overlaps the player (%s)", (status) => {
    const enemies = [
      { pos: { x: 500, y: 500 }, radius: 10 },
      { pos: { x: 5, y: 5 }, radius: 10 },
    ];
    expect(checkLoss({ status, player, enemies })).toBe("lost");
  });

  it.each(ACTIVE_STATUSES)("leaves status untouched when no enemy overlaps (%s)", (status) => {
    const enemies = [{ pos: { x: 500, y: 500 }, radius: 10 }];
    expect(checkLoss({ status, player, enemies })).toBe(status);
  });

  it("does not turn a win back into a loss", () => {
    const enemies = [{ pos: { x: 0, y: 0 }, radius: 10 }];
    expect(checkLoss({ status: "won", player, enemies })).toBe("won");
  });

  it("leaves an existing loss alone even with no enemies left to check", () => {
    expect(checkLoss({ status: "lost", player, enemies: [] })).toBe("lost");
  });
});

describe("circlesOverlap", () => {
  it("is true when two circles touch exactly at their combined radius", () => {
    const a = { pos: { x: 0, y: 0 }, radius: 5 };
    const b = { pos: { x: 10, y: 0 }, radius: 5 };
    expect(circlesOverlap(a, b)).toBe(true);
  });

  it("is false once circles are clearly apart", () => {
    const a = { pos: { x: 0, y: 0 }, radius: 5 };
    const b = { pos: { x: 100, y: 0 }, radius: 5 };
    expect(circlesOverlap(a, b)).toBe(false);
  });
});

describe("collectFragment", () => {
  it("does not flip status on the first fragment", () => {
    expect(collectFragment("explore", 0)).toEqual({ status: "explore", fragmentsCollected: 1 });
  });

  it("does not flip status on the second fragment", () => {
    expect(collectFragment("explore", 1)).toEqual({ status: "explore", fragmentsCollected: 2 });
  });

  it("flips explore to xRevealed only on the third fragment", () => {
    expect(collectFragment("explore", 2)).toEqual({ status: "xRevealed", fragmentsCollected: 3 });
  });
});

describe("reachX", () => {
  it("escapes once xRevealed and all fragments are in hand", () => {
    expect(reachX("xRevealed", 3)).toBe("escaping");
  });

  it("does nothing before the X has been revealed", () => {
    expect(reachX("explore", 3)).toBe("explore");
  });

  it("does nothing if somehow xRevealed without all fragments", () => {
    expect(reachX("xRevealed", 2)).toBe("xRevealed");
  });
});

describe("reachShip", () => {
  it("wins while escaping", () => {
    expect(reachShip("escaping")).toBe("won");
  });

  it("does nothing outside the escaping state", () => {
    expect(reachShip("explore")).toBe("explore");
  });
});
