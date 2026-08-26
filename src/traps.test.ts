import { describe, expect, it } from "vitest";
import {
  createTraps,
  TRAP_ANTICIPATION_DURATION,
  TRAP_ARM_RADIUS,
  TRAP_COOLDOWN_DURATION,
  TRAP_TRIGGER_DURATION,
  trapHitCircles,
  updateTraps,
} from "./traps.ts";
import { buildWorldLayout } from "./world.ts";

describe("createTraps", () => {
  it("creates exactly one dormant trap per configured position", () => {
    const layout = buildWorldLayout();
    const traps = createTraps(layout);
    expect(traps).toHaveLength(layout.trapPositions.length);
    for (const trap of traps) expect(trap.state).toBe("dormant");
  });
});

describe("updateTraps", () => {
  it("stays dormant while the player is outside the arm radius", () => {
    const layout = buildWorldLayout();
    const traps = createTraps(layout);
    const far = { x: traps[0].pos.x + TRAP_ARM_RADIUS * 5, y: traps[0].pos.y };

    updateTraps(traps, far, 1);

    expect(traps[0].state).toBe("dormant");
    expect(trapHitCircles(traps)).toHaveLength(0);
  });

  it("telegraphs, strikes, cools down, then re-arms as the player stands on it", () => {
    const layout = buildWorldLayout();
    const traps = createTraps(layout);
    const trap = traps[0];
    const atTrap = { ...trap.pos };

    updateTraps(traps, atTrap, 0.016);
    expect(trap.state).toBe("anticipating");
    expect(trapHitCircles(traps)).toHaveLength(0);

    updateTraps(traps, atTrap, TRAP_ANTICIPATION_DURATION);
    expect(trap.state).toBe("triggered");
    expect(trapHitCircles(traps)).toHaveLength(1);

    updateTraps(traps, atTrap, TRAP_TRIGGER_DURATION);
    expect(trap.state).toBe("cooldown");
    expect(trapHitCircles(traps)).toHaveLength(0);

    updateTraps(traps, atTrap, TRAP_COOLDOWN_DURATION);
    expect(trap.state).toBe("dormant");
  });

  it("does not re-check for an escape once anticipation has started", () => {
    const layout = buildWorldLayout();
    const traps = createTraps(layout);
    const trap = traps[0];
    const atTrap = { ...trap.pos };
    const far = { x: trap.pos.x + TRAP_ARM_RADIUS * 5, y: trap.pos.y };

    updateTraps(traps, atTrap, 0.016);
    expect(trap.state).toBe("anticipating");

    updateTraps(traps, far, TRAP_ANTICIPATION_DURATION);
    expect(trap.state).toBe("triggered");
  });
});
