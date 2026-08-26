import type { Size, Vec2 } from "./types.ts";

// Follows `target` and clamps to the world bounds, so the camera never shows
// space outside the map even when the player stands near an edge.
export function updateCamera(target: Vec2, viewport: Size, world: Size): Vec2 {
  return {
    x: clamp(target.x - viewport.width / 2, 0, Math.max(0, world.width - viewport.width)),
    y: clamp(target.y - viewport.height / 2, 0, Math.max(0, world.height - viewport.height)),
  };
}

export interface ScreenArrow {
  x: number;
  y: number;
  angle: number;
}

const ARROW_MARGIN = 40;

// null when `targetWorld` is already on screen. Otherwise, the point on an
// inset viewport rectangle where the player-to-target ray exits --- the
// off-screen-ship-arrow math, kept here since it's camera/viewport geometry,
// not rendering. Candidates that would sit behind the ray (wrong sign) come
// out negative and get filtered, so no separate sign branching is needed.
export function offscreenArrow(playerWorld: Vec2, targetWorld: Vec2, camera: Vec2, viewport: Size): ScreenArrow | null {
  const targetScreen = { x: targetWorld.x - camera.x, y: targetWorld.y - camera.y };
  const onScreen =
    targetScreen.x >= 0 && targetScreen.x <= viewport.width && targetScreen.y >= 0 && targetScreen.y <= viewport.height;
  if (onScreen) return null;

  const playerScreen = { x: playerWorld.x - camera.x, y: playerWorld.y - camera.y };
  const dx = targetScreen.x - playerScreen.x;
  const dy = targetScreen.y - playerScreen.y;
  if (dx === 0 && dy === 0) return null;
  const angle = Math.atan2(dy, dx);

  const left = ARROW_MARGIN;
  const right = viewport.width - ARROW_MARGIN;
  const top = ARROW_MARGIN;
  const bottom = viewport.height - ARROW_MARGIN;

  const candidates = [
    dx !== 0 ? (left - playerScreen.x) / dx : Number.POSITIVE_INFINITY,
    dx !== 0 ? (right - playerScreen.x) / dx : Number.POSITIVE_INFINITY,
    dy !== 0 ? (top - playerScreen.y) / dy : Number.POSITIVE_INFINITY,
    dy !== 0 ? (bottom - playerScreen.y) / dy : Number.POSITIVE_INFINITY,
  ].map((t) => (t > 0 && Number.isFinite(t) ? t : Number.POSITIVE_INFINITY));

  const t = Math.min(...candidates);
  if (!Number.isFinite(t)) return null;

  return {
    x: clamp(playerScreen.x + dx * t, left, right),
    y: clamp(playerScreen.y + dy * t, top, bottom),
    angle,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
