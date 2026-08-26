import { describe, expect, it } from "vitest";
import { ATTACK_COOLDOWN, createCombatState, isWithinAttackArc, tryAttack } from "./combat.ts";

describe("tryAttack", () => {
  it("does nothing when no attack was requested", () => {
    const state = createCombatState();
    expect(tryAttack(state, false, 0.1)).toBe(false);
    expect(state.cooldown).toBe(0);
  });

  it("starts a swing and arms the cooldown when requested and ready", () => {
    const state = createCombatState();
    expect(tryAttack(state, true, 0.1)).toBe(true);
    expect(state.cooldown).toBeCloseTo(ATTACK_COOLDOWN);
    expect(state.swingTimer).toBeGreaterThan(0);
  });

  it("refuses a second swing until the cooldown clears", () => {
    const state = createCombatState();
    tryAttack(state, true, 0.1);
    expect(tryAttack(state, true, 0.1)).toBe(false);
  });

  it("allows another swing once the cooldown has fully decayed", () => {
    const state = createCombatState();
    tryAttack(state, true, 0.1);
    tryAttack(state, false, ATTACK_COOLDOWN);
    expect(tryAttack(state, true, 0.1)).toBe(true);
  });
});

describe("isWithinAttackArc", () => {
  const player = { x: 0, y: 0 };

  it("hits a target directly ahead, within range", () => {
    expect(isWithinAttackArc(player, 1, { x: 30, y: 0 })).toBe(true);
  });

  it("misses a target directly behind facing", () => {
    expect(isWithinAttackArc(player, 1, { x: -30, y: 0 })).toBe(false);
  });

  it("misses a target beyond range even if directly ahead", () => {
    expect(isWithinAttackArc(player, 1, { x: 1000, y: 0 })).toBe(false);
  });

  it("respects facing -1 as the mirror of facing 1", () => {
    expect(isWithinAttackArc(player, -1, { x: -30, y: 0 })).toBe(true);
    expect(isWithinAttackArc(player, -1, { x: 30, y: 0 })).toBe(false);
  });

  it("hits a target slightly off-axis but still inside the cone", () => {
    expect(isWithinAttackArc(player, 1, { x: 25, y: 10 })).toBe(true);
  });
});
