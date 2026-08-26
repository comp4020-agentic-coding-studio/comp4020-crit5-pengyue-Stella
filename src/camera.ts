import type { Size, Vec2 } from "./types.ts";

// Follows `target` and clamps to the world bounds, so the camera never shows
// space outside the map even when the player stands near an edge.
export function updateCamera(target: Vec2, viewport: Size, world: Size): Vec2 {
  return {
    x: clamp(target.x - viewport.width / 2, 0, Math.max(0, world.width - viewport.width)),
    y: clamp(target.y - viewport.height / 2, 0, Math.max(0, world.height - viewport.height)),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
